import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
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
import { useWorkspace } from '../useWorkspace';

export function MedicineLibraryPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, 350);
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
                        onChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
                        placeholder="Tìm tên, mã nguồn, barcode, nhà sản xuất"
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
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã nguồn
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Barcode
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà sản xuất
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá tham khảo
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
                                                className="hover:bg-muted/30"
                                            >
                                                <td className="max-w-80 px-4 py-3">
                                                    <p className="font-medium">
                                                        {product.name}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                                        {product.specification ||
                                                            'Chưa có quy cách'}
                                                    </p>
                                                </td>
                                                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                                                    {product.code || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-mono text-xs">
                                                        {product.barcode || '—'}
                                                    </p>
                                                    {product.secondaryBarcode &&
                                                        product.secondaryBarcode !==
                                                        product.barcode ? (
                                                        <p className="text-muted-foreground mt-1 font-mono text-xs">
                                                            {
                                                                product.secondaryBarcode
                                                            }
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="text-muted-foreground max-w-56 px-4 py-3">
                                                    <span className="line-clamp-2">
                                                        {product.manufacturer ||
                                                            '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {product.referencePrice &&
                                                        product.referencePrice > 0
                                                        ? formatCurrency(
                                                            product.referencePrice
                                                        )
                                                        : '—'}
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
