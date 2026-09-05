import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminService } from '@/features/admin/services/admin.service';
import type { Store } from '@/features/admin/types';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { useWorkspace } from '../hooks/useWorkspace';
import { StoreDialog } from '../components/StoreDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pager, Panel, PermissionDenied, SearchInput, StatusBadge } from '../components/shared';

export function StoresPage() {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const { isSystemAdmin } = useWorkspace();

    const storesQuery = useQuery({
        queryKey: ['admin', 'stores', debouncedSearch, page],
        queryFn: () =>
            adminService.getStores({
                search: debouncedSearch,
                page,
                limit: 20,
            }),
        enabled: isSystemAdmin,
    });

    if (!isSystemAdmin) return <PermissionDenied />;

    const openCreate = () => {
        setEditingStore(null);
        setDialogOpen(true);
    };

    const openEdit = (store: Store) => {
        setEditingStore(store);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Quầy thuốc"
                description="Phạm vi tổ chức cấp hệ thống; chỉ System Admin có thể tạo, sửa hoặc khóa quầy."
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        Tạo quầy
                    </Button>
                }
            />

            <Panel className="overflow-hidden">
                <div className="border-border border-b p-4">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Tìm tên quầy thuốc"
                    />
                </div>
                {storesQuery.isPending ? (
                    <LoadingState />
                ) : storesQuery.isError ? (
                    <ErrorState onRetry={() => void storesQuery.refetch()} />
                ) : !storesQuery.data?.results.length ? (
                    <EmptyState
                        title={
                            search
                                ? 'Không tìm thấy quầy thuốc'
                                : 'Chưa có quầy thuốc'
                        }
                        description="Tạo quầy đầu tiên, sau đó thêm Owner tại màn Tài khoản."
                        action={
                            !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Tạo quầy
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Quầy thuốc
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Liên hệ
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Nhân sự
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
                                    {storesQuery.data.results.map((store) => (
                                        <tr
                                            key={store.id}
                                            className="hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium">
                                                    {store.name}
                                                </p>
                                                <p className="text-muted-foreground mt-0.5 text-xs">
                                                    {store.address ||
                                                        'Chưa có địa chỉ'}
                                                </p>
                                            </td>
                                            <td className="text-muted-foreground px-4 py-3">
                                                {store.phone || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Users className="text-muted-foreground size-4" />
                                                    {store._count?.roles ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    tone={
                                                        store.isActive
                                                            ? 'success'
                                                            : 'danger'
                                                    }
                                                >
                                                    {store.isActive
                                                        ? 'Hoạt động'
                                                        : 'Ngừng hoạt động'}
                                                </StatusBadge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        openEdit(store)
                                                    }
                                                    aria-label={`Sửa ${store.name}`}
                                                    title="Sửa quầy thuốc"
                                                >
                                                    <Edit3 />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={storesQuery.data.page}
                            totalPages={storesQuery.data.totalPages}
                            totalResults={storesQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            <StoreDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                store={editingStore}
            />
        </div>
    );
}
