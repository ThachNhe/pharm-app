import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, LoaderCircle, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { adminService } from '@/features/admin/services/admin.service';
import type { Store } from '@/features/admin/types';
import { getApiErrorMessage } from '../api-error';
import { useWorkspace } from '../useWorkspace';
import {
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    PermissionDenied,
    SearchInput,
    StatusBadge,
} from '../components/shared';

const storeSchema = z.object({
    name: z.string().trim().min(1, 'Nhập tên quầy thuốc').max(255),
    phone: z.string().trim().max(20),
    address: z.string().trim().max(1000),
    isActive: z.boolean(),
});

type StoreFormValues = z.infer<typeof storeSchema>;

const emptyValues: StoreFormValues = {
    name: '',
    phone: '',
    address: '',
    isActive: true,
};

function StoreDialog({
    open,
    onOpenChange,
    store,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    store: Store | null;
}) {
    const queryClient = useQueryClient();
    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: emptyValues,
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (!open) return;
        form.reset(
            store
                ? {
                      name: store.name,
                      phone: store.phone ?? '',
                      address: store.address ?? '',
                      isActive: store.isActive,
                  }
                : emptyValues
        );
    }, [form, open, store]);

    const mutation = useMutation({
        mutationFn: async (values: StoreFormValues) => {
            if (store) {
                await adminService.updateStore(store.id, {
                    ...values,
                    phone: values.phone || null,
                    address: values.address || null,
                });
                return;
            }
            await adminService.createStore({
                name: values.name,
                phone: values.phone || null,
                address: values.address || null,
            });
        },
        onSuccess: () => {
            toast.success(
                store ? 'Đã cập nhật quầy thuốc' : 'Đã tạo quầy thuốc'
            );
            void queryClient.invalidateQueries({
                queryKey: ['admin', 'stores'],
            });
            void queryClient.invalidateQueries({
                queryKey: ['workspace', 'context'],
            });
            form.reset(emptyValues);
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể lưu quầy thuốc.')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {store ? 'Cập nhật quầy thuốc' : 'Tạo quầy thuốc'}
                    </DialogTitle>
                    <DialogDescription>
                        Sau khi tạo quầy, thêm Owner tại màn Tài khoản để gửi
                        lời mời đặt mật khẩu.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="store-form"
                    className="space-y-4"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Tên quầy thuốc"
                        required
                        error={form.formState.errors.name?.message}
                    >
                        <Input
                            autoFocus
                            placeholder="Nhà thuốc Trung Tâm"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field
                        label="Số điện thoại"
                        error={form.formState.errors.phone?.message}
                    >
                        <Input
                            inputMode="tel"
                            placeholder="024 1234 5678"
                            {...form.register('phone')}
                        />
                    </Field>
                    <Field
                        label="Địa chỉ"
                        error={form.formState.errors.address?.message}
                    >
                        <textarea
                            rows={3}
                            className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                            placeholder="Địa chỉ kinh doanh"
                            {...form.register('address')}
                        />
                    </Field>
                    {store ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={isActive}
                                onCheckedChange={(checked) =>
                                    form.setValue(
                                        'isActive',
                                        checked === true,
                                        {
                                            shouldDirty: true,
                                        }
                                    )
                                }
                            />
                            Quầy đang hoạt động
                        </label>
                    ) : null}
                </form>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        Hủy
                    </Button>
                    <Button
                        form="store-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        {store ? 'Lưu thay đổi' : 'Tạo quầy'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function StoresPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const debouncedSearch = useDebounce(search, 350);
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
                        onChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
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
