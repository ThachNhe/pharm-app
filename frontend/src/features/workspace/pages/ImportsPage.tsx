import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle2,
    Eye,
    LoaderCircle,
    Plus,
    Trash2,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    toDateInputValue,
} from '@/lib/utils';
import { getApiErrorMessage } from '../utils/api-error';
import { workspaceService } from '../services/workspace.service';
import type { ImportReceipt, ReceiptStatus } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    PermissionDenied,
    StatusBadge,
} from '../components/shared';

const todayDate = new Date();
const today = toDateInputValue(todayDate);
const tomorrow = toDateInputValue(
    new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate() + 1
    )
);

const importSchema = z.object({
    supplierId: z.string(),
    importedAt: z.string().min(1, 'Chọn ngày nhập'),
    note: z.string().trim().max(2000),
    items: z
        .array(
            z.object({
                medicineId: z.string().min(1, 'Chọn sản phẩm'),
                unitId: z.string().min(1, 'Chọn đơn vị'),
                batchNumber: z.string().trim().min(1, 'Nhập số lô').max(100),
                quantity: z
                    .number({ error: 'Nhập số lượng hợp lệ' })
                    .positive('Số lượng phải lớn hơn 0'),
                importPrice: z
                    .number({ error: 'Nhập giá nhập hợp lệ' })
                    .min(0, 'Giá nhập không được âm'),
                expiryDate: z
                    .string()
                    .min(1, 'Chọn hạn dùng')
                    .refine(
                        (value) => value > today,
                        'Hạn dùng phải sau hôm nay'
                    ),
            })
        )
        .min(1, 'Phiếu nhập cần ít nhất một dòng sản phẩm'),
});

type ImportFormValues = z.infer<typeof importSchema>;

const emptyItem: ImportFormValues['items'][number] = {
    medicineId: '',
    unitId: '',
    batchNumber: '',
    quantity: 1,
    importPrice: 0,
    expiryDate: '',
};

function CreateImportDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();
    const form = useForm<ImportFormValues>({
        resolver: zodResolver(importSchema),
        defaultValues: {
            supplierId: '',
            importedAt: today,
            note: '',
            items: [{ ...emptyItem }],
        },
    });
    const items = useWatch({ control: form.control, name: 'items' });
    const total = useMemo(
        () =>
            items.reduce(
                (sum, item) =>
                    sum +
                    (Number.isFinite(item.quantity) ? item.quantity : 0) *
                        (Number.isFinite(item.importPrice)
                            ? item.importPrice
                            : 0),
                0
            ),
        [items]
    );
    const fields = useFieldArray({ control: form.control, name: 'items' });

    const suppliersQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'suppliers', 'options'],
        queryFn: () =>
            workspaceService.getSuppliers(selectedStoreId, {
                page: 1,
                limit: 100,
            }),
        enabled: open && Boolean(selectedStoreId),
    });
    const medicinesQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'medicines', 'options'],
        queryFn: () =>
            workspaceService.getMedicines(selectedStoreId, {
                page: 1,
                limit: 100,
                active: true,
            }),
        enabled: open && Boolean(selectedStoreId),
    });

    useEffect(() => {
        if (!open) return;
        form.reset({
            supplierId: '',
            importedAt: today,
            note: '',
            items: [{ ...emptyItem }],
        });
    }, [form, open, selectedStoreId]);

    const mutation = useMutation({
        mutationFn: (values: ImportFormValues) =>
            workspaceService.createImport(selectedStoreId, {
                ...values,
                supplierId: values.supplierId || null,
                note: values.note || undefined,
            }),
        onSuccess: () => {
            toast.success('Đã lưu phiếu nhập nháp');
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'imports'],
            });
            form.reset();
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể tạo phiếu nhập.')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Lập phiếu nhập hàng</DialogTitle>
                    <DialogDescription>
                        Phiếu được lưu ở trạng thái nháp và chưa làm thay đổi
                        tồn kho.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="import-form"
                    className="space-y-5"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                        <Field
                            label="Nhà cung cấp"
                            error={form.formState.errors.supplierId?.message}
                        >
                            <select
                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 w-full rounded-md border px-3 text-sm outline-none focus:ring-3"
                                {...form.register('supplierId')}
                            >
                                <option value="">
                                    Không chọn nhà cung cấp
                                </option>
                                {suppliersQuery.data?.results
                                    .filter((supplier) => supplier.isActive)
                                    .map((supplier) => (
                                        <option
                                            key={supplier.id}
                                            value={supplier.id}
                                        >
                                            {supplier.name}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                        <Field
                            label="Ngày nhập"
                            required
                            error={form.formState.errors.importedAt?.message}
                        >
                            <Input
                                type="date"
                                {...form.register('importedAt')}
                            />
                        </Field>
                    </div>

                    <div className="border-border overflow-hidden rounded-lg border">
                        <div className="border-border bg-muted/45 flex items-center justify-between gap-3 border-b px-4 py-3">
                            <div>
                                <h3 className="text-sm font-semibold">
                                    Chi tiết lô hàng
                                </h3>
                                <p className="text-muted-foreground text-xs">
                                    Mỗi sản phẩm và số lô chỉ xuất hiện một lần.
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => fields.append({ ...emptyItem })}
                            >
                                <Plus />
                                Thêm dòng
                            </Button>
                        </div>
                        <div className="divide-border divide-y">
                            {fields.fields.map((field, index) => {
                                const itemErrors =
                                    form.formState.errors.items?.[index];
                                const selectedMedicine =
                                    medicinesQuery.data?.results.find(
                                        (medicine) =>
                                            medicine.id ===
                                            items[index]?.medicineId
                                    );
                                return (
                                    <div
                                        key={field.id}
                                        className="grid items-start gap-3 p-4 lg:grid-cols-[minmax(180px,1.6fr)_100px_minmax(120px,1fr)_110px_140px_155px_36px]"
                                    >
                                        <Field
                                            label="Sản phẩm"
                                            required
                                            error={
                                                itemErrors?.medicineId?.message
                                            }
                                        >
                                            <select
                                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 w-full min-w-0 rounded-md border px-3 text-sm outline-none focus:ring-3"
                                                {...form.register(
                                                    `items.${index}.medicineId`,
                                                    {
                                                        onChange: (event) => {
                                                            const medicine =
                                                                medicinesQuery.data?.results.find(
                                                                    (item) =>
                                                                        item.id ===
                                                                        event
                                                                            .target
                                                                            .value
                                                                );
                                                            form.setValue(
                                                                `items.${index}.unitId`,
                                                                medicine?.units.find(
                                                                    (unit) =>
                                                                        unit.isBaseUnit
                                                                )?.id ?? '',
                                                                {
                                                                    shouldDirty: true,
                                                                    shouldValidate: true,
                                                                }
                                                            );
                                                        },
                                                    }
                                                )}
                                            >
                                                <option value="">
                                                    Chọn sản phẩm
                                                </option>
                                                {medicinesQuery.data?.results.map(
                                                    (medicine) => (
                                                        <option
                                                            key={medicine.id}
                                                            value={medicine.id}
                                                        >
                                                            {medicine.name}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </Field>
                                        <Field
                                            label="ĐVT"
                                            required
                                            error={itemErrors?.unitId?.message}
                                        >
                                            <select
                                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 w-full rounded-md border px-2 text-sm outline-none focus:ring-3"
                                                disabled={!selectedMedicine}
                                                {...form.register(
                                                    `items.${index}.unitId`
                                                )}
                                            >
                                                <option value="">
                                                    Chọn ĐVT
                                                </option>
                                                {selectedMedicine?.units.map(
                                                    (unit) => (
                                                        <option
                                                            key={unit.id}
                                                            value={unit.id}
                                                        >
                                                            {unit.name}
                                                            {unit.isBaseUnit
                                                                ? ''
                                                                : ` (x${formatNumber(unit.conversionRate)})`}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </Field>
                                        <Field
                                            label="Số lô"
                                            required
                                            error={
                                                itemErrors?.batchNumber?.message
                                            }
                                        >
                                            <Input
                                                placeholder="LO-2026-01"
                                                {...form.register(
                                                    `items.${index}.batchNumber`
                                                )}
                                            />
                                        </Field>
                                        <Field
                                            label="Số lượng"
                                            required
                                            error={
                                                itemErrors?.quantity?.message
                                            }
                                        >
                                            <Input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                inputMode="decimal"
                                                {...form.register(
                                                    `items.${index}.quantity`,
                                                    {
                                                        valueAsNumber: true,
                                                    }
                                                )}
                                            />
                                        </Field>
                                        <Field
                                            label="Giá nhập / ĐVT"
                                            required
                                            error={
                                                itemErrors?.importPrice?.message
                                            }
                                        >
                                            <Input
                                                type="number"
                                                min="0"
                                                step="100"
                                                inputMode="decimal"
                                                {...form.register(
                                                    `items.${index}.importPrice`,
                                                    {
                                                        valueAsNumber: true,
                                                    }
                                                )}
                                            />
                                        </Field>
                                        <Field
                                            label="Hạn sử dụng"
                                            required
                                            error={
                                                itemErrors?.expiryDate?.message
                                            }
                                        >
                                            <Input
                                                type="date"
                                                min={tomorrow}
                                                {...form.register(
                                                    `items.${index}.expiryDate`
                                                )}
                                            />
                                        </Field>
                                        <div className="flex items-start pt-[1.625rem]">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                disabled={
                                                    fields.fields.length === 1
                                                }
                                                onClick={() =>
                                                    fields.remove(index)
                                                }
                                                aria-label={`Xóa dòng ${index + 1}`}
                                                title="Xóa dòng"
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
                        <Field
                            label="Ghi chú"
                            error={form.formState.errors.note?.message}
                        >
                            <textarea
                                rows={3}
                                className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                                placeholder="Số hóa đơn, điều kiện giao hàng..."
                                {...form.register('note')}
                            />
                        </Field>
                        <div className="border-primary/20 bg-secondary rounded-lg border p-4">
                            <p className="text-muted-foreground text-sm">
                                Tổng tiền nhập
                            </p>
                            <p className="text-brand-navy mt-2 text-2xl font-semibold">
                                {formatCurrency(total)}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                                {fields.fields.length} dòng hàng
                            </p>
                        </div>
                    </div>
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
                        form="import-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        Lưu phiếu nháp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const statusMeta: Record<
    ReceiptStatus,
    { label: string; tone: 'warning' | 'success' | 'neutral' }
> = {
    draft: { label: 'Phiếu nháp', tone: 'warning' },
    completed: { label: 'Đã nhập kho', tone: 'success' },
    cancelled: { label: 'Đã hủy', tone: 'neutral' },
};

function ImportDetailDialog({
    receipt,
    onClose,
}: {
    receipt: ImportReceipt | null;
    onClose: () => void;
}) {
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();

    const invalidate = () => {
        void queryClient.invalidateQueries({
            queryKey: ['workspace', selectedStoreId, 'imports'],
        });
        void queryClient.invalidateQueries({
            queryKey: ['workspace', selectedStoreId, 'inventory'],
        });
        void queryClient.invalidateQueries({
            queryKey: ['workspace', selectedStoreId, 'dashboard'],
        });
    };

    const completeMutation = useMutation({
        mutationFn: () =>
            workspaceService.completeImport(selectedStoreId, receipt?.id ?? ''),
        onSuccess: () => {
            toast.success('Đã hoàn tất nhập kho');
            invalidate();
            onClose();
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(error, 'Không thể hoàn tất phiếu nhập.')
            ),
    });
    const cancelMutation = useMutation({
        mutationFn: () =>
            workspaceService.cancelImport(selectedStoreId, receipt?.id ?? ''),
        onSuccess: () => {
            toast.success('Đã hủy phiếu nhập');
            invalidate();
            onClose();
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể hủy phiếu nhập.')),
    });

    if (!receipt) return null;
    const meta = statusMeta[receipt.status];

    return (
        <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <div className="flex flex-wrap items-center gap-3">
                        <DialogTitle>
                            Phiếu nhập #{receipt.id.slice(0, 8).toUpperCase()}
                        </DialogTitle>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </div>
                    <DialogDescription>
                        Lập lúc {formatDateTime(receipt.createdAt)} bởi{' '}
                        {receipt.createdByUser.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted/45 grid gap-3 rounded-lg p-4 text-sm sm:grid-cols-3">
                    <div>
                        <p className="text-muted-foreground">Nhà cung cấp</p>
                        <p className="mt-1 font-medium">
                            {receipt.supplier?.name ??
                                receipt.supplierNameSnapshot ??
                                'Không ghi nhận'}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Ngày nhập</p>
                        <p className="mt-1 font-medium">
                            {formatDate(receipt.importedAt)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Tổng tiền</p>
                        <p className="text-primary mt-1 font-semibold">
                            {formatCurrency(receipt.totalAmount)}
                        </p>
                    </div>
                </div>

                <div className="border-border overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 font-medium">
                                    Sản phẩm
                                </th>
                                <th className="px-4 py-3 font-medium">Số lô</th>
                                <th className="px-4 py-3 font-medium">
                                    Hạn dùng
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Số lượng
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Giá nhập
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Thành tiền
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                            {receipt.details.map((detail) => (
                                <tr key={detail.id}>
                                    <td className="px-4 py-3 font-medium">
                                        {detail.medicine.name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {detail.batchNumber}
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatDate(detail.expiryDate)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatNumber(detail.quantity)}{' '}
                                        {detail.unitName.toLowerCase()}
                                        {detail.conversionRate !== 1 ? (
                                            <p className="text-muted-foreground text-xs">
                                                ={' '}
                                                {formatNumber(
                                                    detail.baseQuantity
                                                )}{' '}
                                                {detail.medicine.baseUnitName.toLowerCase()}
                                            </p>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatCurrency(detail.importPrice)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {formatCurrency(
                                            detail.quantity * detail.importPrice
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {receipt.note ? (
                    <p className="border-border rounded-lg border px-4 py-3 text-sm">
                        <span className="font-medium">Ghi chú:</span>{' '}
                        {receipt.note}
                    </p>
                ) : null}

                {receipt.status === 'draft' ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Hoàn tất phiếu sẽ tạo lô và tăng tồn kho. Thao tác này
                        không thể sửa trực tiếp sau khi xác nhận.
                    </div>
                ) : null}

                <DialogFooter>
                    {receipt.status === 'draft' ? (
                        <>
                            <Button
                                variant="outline"
                                disabled={
                                    cancelMutation.isPending ||
                                    completeMutation.isPending
                                }
                                onClick={() => cancelMutation.mutate()}
                            >
                                {cancelMutation.isPending ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <XCircle />
                                )}
                                Hủy phiếu
                            </Button>
                            <Button
                                disabled={
                                    cancelMutation.isPending ||
                                    completeMutation.isPending
                                }
                                onClick={() => completeMutation.mutate()}
                            >
                                {completeMutation.isPending ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <CheckCircle2 />
                                )}
                                Hoàn tất nhập kho
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={onClose}>
                            Đóng
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ImportsPage() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<ReceiptStatus | ''>('');
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] =
        useState<ImportReceipt | null>(null);
    const { selectedStoreId, hasRole } = useWorkspace();

    const importsQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'imports', status, page],
        queryFn: () =>
            workspaceService.getImports(selectedStoreId, {
                status,
                page,
                limit: 20,
            }),
        enabled: Boolean(selectedStoreId) && hasRole('manager'),
    });

    if (!hasRole('manager')) return <PermissionDenied />;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Nhập hàng"
                description="Lập phiếu nháp, kiểm tra lô và xác nhận nhập kho theo từng quầy."
                actions={
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus />
                        Lập phiếu nhập
                    </Button>
                }
            />

            <Panel className="overflow-hidden">
                <div className="border-border flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['', 'Tất cả'],
                            ['draft', 'Phiếu nháp'],
                            ['completed', 'Đã nhập kho'],
                            ['cancelled', 'Đã hủy'],
                        ].map(([value, label]) => (
                            <Button
                                key={value}
                                size="sm"
                                variant={
                                    status === value ? 'secondary' : 'ghost'
                                }
                                onClick={() => {
                                    setStatus(value as ReceiptStatus | '');
                                    setPage(1);
                                }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {formatNumber(importsQuery.data?.totalResults ?? 0)}{' '}
                        phiếu
                    </p>
                </div>

                {importsQuery.isPending ? (
                    <LoadingState />
                ) : importsQuery.isError ? (
                    <ErrorState onRetry={() => void importsQuery.refetch()} />
                ) : !importsQuery.data?.results.length ? (
                    <EmptyState
                        title="Chưa có phiếu nhập phù hợp"
                        description="Lập phiếu nhập đầu tiên để tiếp nhận lô hàng vào kho."
                        action={
                            !status ? (
                                <Button onClick={() => setCreateOpen(true)}>
                                    <Plus />
                                    Lập phiếu nhập
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
                                            Mã phiếu
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Ngày nhập
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà cung cấp
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Số dòng
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Tổng tiền
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Trạng thái
                                        </th>
                                        <th className="w-16 px-4 py-3 text-right font-medium">
                                            Xem
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {importsQuery.data.results.map(
                                        (receipt) => {
                                            const meta =
                                                statusMeta[receipt.status];
                                            return (
                                                <tr
                                                    key={receipt.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs font-medium">
                                                        #
                                                        {receipt.id
                                                            .slice(0, 8)
                                                            .toUpperCase()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatDate(
                                                            receipt.importedAt
                                                        )}
                                                        <p className="text-muted-foreground text-xs">
                                                            {
                                                                receipt
                                                                    .createdByUser
                                                                    .name
                                                            }
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {receipt.supplier
                                                            ?.name ??
                                                            receipt.supplierNameSnapshot ??
                                                            'Không ghi nhận'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(
                                                            receipt.details
                                                                .length
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">
                                                        {formatCurrency(
                                                            receipt.totalAmount
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge
                                                            tone={meta.tone}
                                                        >
                                                            {meta.label}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                setSelectedReceipt(
                                                                    receipt
                                                                )
                                                            }
                                                            aria-label={`Xem phiếu ${receipt.id}`}
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={importsQuery.data.page}
                            totalPages={importsQuery.data.totalPages}
                            totalResults={importsQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            <CreateImportDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
            <ImportDetailDialog
                receipt={selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
            />
        </div>
    );
}
