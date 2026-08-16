import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { ProductCategoryDialog } from '../components/ProductCategoryDialog';
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
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { useWorkspace } from '../hooks/useWorkspace';
import { workspaceService } from '../services/workspace.service';
import type { ProductCategory } from '../types';

export function ProductCategoriesPage() {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const { selectedStoreId, hasRole } = useWorkspace();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] =
        useState<ProductCategory | null>(null);
    const canManage = hasRole('manager');
    const categoriesQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'product-categories',
            debouncedSearch,
            page,
        ],
        queryFn: () =>
            workspaceService.getProductCategories(selectedStoreId, {
                search: debouncedSearch,
                page,
                limit: 20,
            }),
        enabled: Boolean(selectedStoreId) && canManage,
    });

    const openCreate = () => {
        setEditingCategory(null);
        setDialogOpen(true);
    };

    const openEdit = (category: ProductCategory) => {
        setEditingCategory(category);
        setDialogOpen(true);
    };

    if (!canManage) {
        return (
            <div className="space-y-5">
                <PageHeader
                    title="Nhóm sản phẩm"
                    description="Quản lý các nhóm hàng hóa của quầy."
                />
                <Panel>
                    <EmptyState
                        title="Bạn không có quyền quản lý nhóm sản phẩm"
                        description="Chức năng này dành cho chủ quầy và quản lý."
                    />
                </Panel>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Nhóm sản phẩm"
                description="Phân nhóm thuốc và các mặt hàng khác đang kinh doanh tại quầy."
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        Thêm nhóm
                    </Button>
                }
            />

            <Panel className="overflow-hidden">
                <div className="border-border flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Tìm tên hoặc mô tả nhóm"
                    />
                    <p className="text-muted-foreground text-sm">
                        {formatNumber(categoriesQuery.data?.totalResults ?? 0)}{' '}
                        nhóm
                    </p>
                </div>

                {categoriesQuery.isPending ? (
                    <LoadingState label="Đang tải nhóm sản phẩm" />
                ) : categoriesQuery.isError ? (
                    <ErrorState
                        description="Không tải được danh sách nhóm sản phẩm."
                        onRetry={() => void categoriesQuery.refetch()}
                    />
                ) : !categoriesQuery.data?.results.length ? (
                    <EmptyState
                        title={
                            search
                                ? 'Không tìm thấy nhóm phù hợp'
                                : 'Chưa có nhóm sản phẩm'
                        }
                        description={
                            search
                                ? 'Thử một từ khóa khác.'
                                : 'Thêm nhóm đầu tiên để phân loại sản phẩm khi nhập vào quầy.'
                        }
                        action={
                            !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Thêm nhóm
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Tên nhóm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mô tả
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Trạng thái
                                        </th>
                                        <th className="w-16 px-4 py-3 text-right font-medium">
                                            Sửa
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {categoriesQuery.data.results.map(
                                        (category) => (
                                            <tr
                                                key={category.id}
                                                className="hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3 font-medium">
                                                    {category.name}
                                                </td>
                                                <td className="text-muted-foreground max-w-md px-4 py-3">
                                                    <span className="line-clamp-2">
                                                        {category.description ||
                                                            '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatNumber(
                                                        category.productCount
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge
                                                        tone={
                                                            category.isActive
                                                                ? 'success'
                                                                : 'neutral'
                                                        }
                                                    >
                                                        {category.isActive
                                                            ? 'Đang hoạt động'
                                                            : 'Ngừng hoạt động'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        size="icon-sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openEdit(category)
                                                        }
                                                        aria-label={`Sửa ${category.name}`}
                                                        title="Sửa nhóm sản phẩm"
                                                    >
                                                        <Edit3 />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={categoriesQuery.data.page}
                            totalPages={categoriesQuery.data.totalPages}
                            totalResults={categoriesQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            {dialogOpen ? (
                <ProductCategoryDialog
                    open
                    onOpenChange={setDialogOpen}
                    category={editingCategory}
                />
            ) : null}
        </div>
    );
}
