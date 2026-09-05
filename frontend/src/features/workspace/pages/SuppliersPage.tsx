import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, LoaderCircle, Plus } from 'lucide-react';
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
import { getApiErrorMessage } from '../utils/api-error';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { workspaceService } from '../services/workspace.service';
import type { Supplier } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    SearchInput,
    StatusBadge,
} from '../components/shared';

const supplierSchema = z.object({
    code: z.string().trim().max(50),
    name: z.string().trim().min(1, 'Nhập tên nhà cung cấp').max(255),
    phone: z.string().trim().max(20),
    email: z
        .string()
        .trim()
        .refine(
            (value) => !value || z.email().safeParse(value).success,
            'Email không hợp lệ'
        ),
    address: z.string().trim().max(1000),
    taxCode: z.string().trim().max(50),
    isActive: z.boolean(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

const emptyValues: SupplierFormValues = {
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    isActive: true,
};

function SupplierDialog({
    open,
    onOpenChange,
    supplier,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
}) {
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();
    const form = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierSchema),
        defaultValues: emptyValues,
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (!open) return;
        form.reset(
            supplier
                ? {
                      code: supplier.code ?? '',
                      name: supplier.name,
                      phone: supplier.phone ?? '',
                      email: supplier.email ?? '',
                      address: supplier.address ?? '',
                      taxCode: supplier.taxCode ?? '',
                      isActive: supplier.isActive,
                  }
                : emptyValues
        );
    }, [form, open, supplier]);

    const mutation = useMutation({
        mutationFn: (values: SupplierFormValues) => {
            const payload = {
                ...values,
                code: values.code || undefined,
                phone: values.phone || undefined,
                email: values.email || undefined,
                address: values.address || undefined,
                taxCode: values.taxCode || undefined,
            };
            return supplier
                ? workspaceService.updateSupplier(
                      selectedStoreId,
                      supplier.id,
                      payload
                  )
                : workspaceService.createSupplier(selectedStoreId, payload);
        },
        onSuccess: () => {
            toast.success(
                supplier ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp'
            );
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'suppliers'],
            });
            form.reset(emptyValues);
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(
                    error,
                    'Không thể lưu thông tin nhà cung cấp.'
                )
            ),
    });

    const errors = form.formState.errors;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {supplier
                            ? 'Cập nhật nhà cung cấp'
                            : 'Thêm nhà cung cấp'}
                    </DialogTitle>
                    <DialogDescription>
                        Mã nhà cung cấp chỉ cần duy nhất trong quầy đang chọn.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="supplier-form"
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Tên nhà cung cấp"
                        required
                        error={errors.name?.message}
                    >
                        <Input
                            autoFocus
                            placeholder="Công ty Dược ABC"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field label="Mã nhà cung cấp" error={errors.code?.message}>
                        <Input
                            placeholder="NCC-001"
                            {...form.register('code')}
                        />
                    </Field>
                    <Field label="Số điện thoại" error={errors.phone?.message}>
                        <Input
                            inputMode="tel"
                            placeholder="0901 234 567"
                            {...form.register('phone')}
                        />
                    </Field>
                    <Field label="Email" error={errors.email?.message}>
                        <Input
                            type="email"
                            placeholder="lienhe@duocabc.vn"
                            {...form.register('email')}
                        />
                    </Field>
                    <Field label="Mã số thuế" error={errors.taxCode?.message}>
                        <Input
                            placeholder="0101234567"
                            {...form.register('taxCode')}
                        />
                    </Field>
                    <Field
                        label="Địa chỉ"
                        error={errors.address?.message}
                        className="sm:col-span-2"
                    >
                        <textarea
                            rows={3}
                            className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                            placeholder="Địa chỉ giao dịch"
                            {...form.register('address')}
                        />
                    </Field>
                    {supplier ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
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
                            Đang hợp tác
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
                        form="supplier-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        Lưu nhà cung cấp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function SuppliersPage() {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(
        null
    );
    const { selectedStoreId, hasRole } = useWorkspace();
    const canManage = hasRole('manager');

    const suppliersQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'suppliers',
            debouncedSearch,
            page,
        ],
        queryFn: () =>
            workspaceService.getSuppliers(selectedStoreId, {
                search: debouncedSearch,
                page,
                limit: 20,
            }),
        enabled: Boolean(selectedStoreId),
    });


    const openCreate = () => {
        setEditingSupplier(null);
        setDialogOpen(true);
    };

    const openEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Nhà cung cấp"
                description="Quản lý đối tác giao hàng và thông tin liên hệ theo từng quầy."
                actions={canManage ? (
                    <Button onClick={openCreate}>
                        <Plus />
                        Thêm nhà cung cấp
                    </Button>
                ) : undefined}
            />

            <Panel className="overflow-hidden">
                <div className="border-border border-b p-4">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Tìm tên, mã, số điện thoại"
                    />
                </div>
                {suppliersQuery.isPending ? (
                    <LoadingState />
                ) : suppliersQuery.isError ? (
                    <ErrorState onRetry={() => void suppliersQuery.refetch()} />
                ) : !suppliersQuery.data?.results.length ? (
                    <EmptyState
                        title={
                            search
                                ? 'Không tìm thấy nhà cung cấp'
                                : 'Chưa có nhà cung cấp'
                        }
                        description="Thêm nhà cung cấp trước khi lập phiếu nhập để lưu đúng nguồn hàng."
                        action={
                            canManage && !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Thêm nhà cung cấp
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà cung cấp
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Liên hệ
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã số thuế
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
                                    {suppliersQuery.data.results.map(
                                        (supplier) => (
                                            <tr
                                                key={supplier.id}
                                                className="hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">
                                                        {supplier.name}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {supplier.code ||
                                                            'Chưa có mã'}{' '}
                                                        ·{' '}
                                                        {supplier.address ||
                                                            'Chưa có địa chỉ'}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p>
                                                        {supplier.phone || '—'}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {supplier.email ||
                                                            'Chưa có email'}
                                                    </p>
                                                </td>
                                                <td className="text-muted-foreground px-4 py-3">
                                                    {supplier.taxCode || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge
                                                        tone={
                                                            supplier.isActive
                                                                ? 'success'
                                                                : 'neutral'
                                                        }
                                                    >
                                                        {supplier.isActive
                                                            ? 'Đang hợp tác'
                                                            : 'Ngừng hợp tác'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {canManage ? <Button
                                                        size="icon-sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openEdit(supplier)
                                                        }
                                                        aria-label={`Sửa ${supplier.name}`}
                                                        title="Sửa nhà cung cấp"
                                                    >
                                                        <Edit3 />
                                                    </Button> : null}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={suppliersQuery.data.page}
                            totalPages={suppliersQuery.data.totalPages}
                            totalResults={suppliersQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            {canManage && <SupplierDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                supplier={editingSupplier}
            />}
        </div>
    );
}
