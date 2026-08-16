import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
    EmptyState,
    ErrorState,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    SearchInput,
    StatusBadge,
} from '../components/shared';
import { workspaceService } from '../services/workspace.service';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { useWorkspace } from '../hooks/useWorkspace';

const showText = (value?: string | null) => value?.trim() || '—';
const showMoney = (value?: number | null) =>
    value == null ? '—' : formatCurrency(value);
const showPercent = (value?: number | null) =>
    value == null ? '—' : `${formatNumber(value)}%`;
const showQuantity = (value?: number | null) =>
    value == null ? '—' : formatNumber(value);

export function MedicineLibraryPage() {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const { selectedStoreId, hasRole } = useWorkspace();
    const canManage = hasRole('manager');

    const productsQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'reference-products',
            debouncedSearch,
            page,
        ],
        queryFn: () =>
            workspaceService.getReferenceProducts(selectedStoreId, {
                search: debouncedSearch,
                page,
                limit: 15,
            }),
        enabled: Boolean(selectedStoreId),
        placeholderData: (previous) => previous,
    });

    return (
        <div className="space-y-5">
            <PageHeader
                title="Thư viện thuốc"
                description="Danh mục tham khảo giúp tìm và điền nhanh thông tin khi thêm thuốc. Dữ liệu chưa được dùng cho nhập hàng hoặc bán hàng cho đến khi được thêm vào quầy."
                actions={
                    canManage ? (
                        <Button asChild>
                            <Link to="/admin/medicines">
                                <Plus />
                                Thêm thuốc vào quầy
                            </Link>
                        </Button>
                    ) : undefined
                }
            />

            <Panel className="overflow-hidden">
                <div className="border-border flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Tìm tên, mã, barcode, SĐK, hoạt chất..."
                        className="sm:w-96"
                    />
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        {productsQuery.isFetching &&
                        !productsQuery.isPending ? (
                            <LoaderCircle
                                className="size-4 animate-spin"
                                aria-label="Đang cập nhật"
                            />
                        ) : null}
                        {formatNumber(productsQuery.data?.totalResults ?? 0)}{' '}
                        sản phẩm
                    </p>
                </div>
                <div className="bg-secondary/35 text-muted-foreground border-border border-b px-4 py-2.5 text-xs">
                    Số lô, hạn dùng và số lượng thực tế được quản lý tại Tồn kho
                    theo từng quầy sau khi nhập hàng. Bảng chi tiết có thể cuộn
                    ngang.
                </div>

                {productsQuery.isPending ? (
                    <LoadingState label="Đang tải thư viện thuốc" />
                ) : productsQuery.isError ? (
                    <ErrorState
                        description="Không thể tải thư viện thuốc. Vui lòng kiểm tra kết nối rồi thử lại."
                        onRetry={() => void productsQuery.refetch()}
                    />
                ) : !productsQuery.data?.results.length ? (
                    <EmptyState
                        title={
                            search
                                ? 'Không tìm thấy sản phẩm phù hợp'
                                : 'Thư viện thuốc đang trống'
                        }
                        description={
                            search
                                ? 'Thử tìm bằng tên ngắn hơn, mã nguồn hoặc barcode.'
                                : 'Hãy chạy tác vụ import dữ liệu thư viện trước.'
                        }
                    />
                ) : (
                    <>
                        <div
                            className="overflow-x-auto"
                            tabIndex={0}
                            aria-label="Bảng thông tin chi tiết thư viện thuốc"
                        >
                            <table className="w-full min-w-[3800px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="bg-muted sticky left-0 z-20 w-32 min-w-32 px-4 py-3 font-medium">
                                            Mã
                                        </th>
                                        <th className="bg-muted sticky left-32 z-20 w-80 min-w-80 px-4 py-3 font-medium">
                                            Tên sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            ĐVT
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá nhập
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá bán lẻ
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            SĐK/GPNK
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá bán buôn
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hãng sản xuất
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nước SX
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà nhập khẩu
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hoạt chất
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            % CK-BS
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            % CK-NV
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã vạch 1
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã vạch 2
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hướng dẫn sử dụng
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Tồn kho T.T
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Quy cách
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhóm sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Vị trí
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà cung cấp
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Tại quầy
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {productsQuery.data.results.map(
                                        (product) => (
                                            <tr
                                                key={product.id}
                                                className="group hover:bg-muted/30"
                                            >
                                                <td className="bg-card group-hover:bg-muted sticky left-0 z-10 w-32 min-w-32 px-4 py-3 font-mono text-xs whitespace-nowrap transition-colors">
                                                    {showText(product.code)}
                                                </td>
                                                <td className="bg-card group-hover:bg-muted sticky left-32 z-10 w-80 max-w-80 min-w-80 px-4 py-3 font-medium transition-colors">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={product.name}
                                                    >
                                                        {product.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {showText(product.unitName)}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {showMoney(
                                                        product.inputPrice
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                                    {showMoney(
                                                        product.referencePrice
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {showText(
                                                        product.registrationNumber
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {showMoney(
                                                        product.wholesalePrice
                                                    )}
                                                </td>
                                                <td className="max-w-64 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.manufacturer ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.manufacturer
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="max-w-48 px-4 py-3">
                                                    {showText(
                                                        product.countryOfOrigin
                                                    )}
                                                </td>
                                                <td className="max-w-64 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.importerName ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.importerName
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="max-w-64 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.activeIngredient ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.activeIngredient
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {showPercent(
                                                        product.doctorDiscountPercent
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {showPercent(
                                                        product.employeeDiscountPercent
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                                    {showText(product.barcode)}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                                    {showText(
                                                        product.secondaryBarcode
                                                    )}
                                                </td>
                                                <td className="max-w-72 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.usageInstructions ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.usageInstructions
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {showQuantity(
                                                        product.minInventory
                                                    )}
                                                </td>
                                                <td className="max-w-72 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.specification ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.specification
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {showText(
                                                        product.categoryName
                                                    )}
                                                </td>
                                                <td className="max-w-64 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.positionName ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.positionName
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="max-w-64 px-4 py-3">
                                                    <span
                                                        className="line-clamp-2"
                                                        title={
                                                            product.supplierName ??
                                                            undefined
                                                        }
                                                    >
                                                        {showText(
                                                            product.supplierName
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge
                                                        tone={
                                                            product.isAddedToStore
                                                                ? 'success'
                                                                : 'neutral'
                                                        }
                                                    >
                                                        {product.isAddedToStore
                                                            ? 'Đã thêm'
                                                            : 'Chưa thêm'}
                                                    </StatusBadge>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={productsQuery.data.page}
                            totalPages={productsQuery.data.totalPages}
                            totalResults={productsQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>
        </div>
    );
}
