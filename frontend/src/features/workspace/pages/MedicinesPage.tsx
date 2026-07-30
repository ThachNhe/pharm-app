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
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getApiErrorMessage } from '../api-error';
import { workspaceService } from '../services/workspace.service';
import type { Medicine } from '../types';
import { useWorkspace } from '../useWorkspace';
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

const medicineSchema = z.object({
    name: z.string().trim().min(1, 'Nhập tên thuốc').max(255),
    baseUnitName: z.string().trim().min(1, 'Nhập đơn vị cơ bản').max(50),
    barcode: z.string().trim().max(100),
    registrationNumber: z.string().trim().max(100),
    category: z.string().trim().max(100),
    activeIngredient: z.string().trim().max(255),
    strength: z.string().trim().max(100),
    dosageForm: z.string().trim().max(100),
    manufacturer: z.string().trim().max(255),
    sellingPrice: z
        .number({ error: 'Nhập giá bán hợp lệ' })
        .min(0, 'Giá bán không được âm'),
    minStock: z
        .number({ error: 'Nhập tồn tối thiểu hợp lệ' })
        .min(0, 'Tồn tối thiểu không được âm'),
    requiresPrescription: z.boolean(),
    description: z.string().trim().max(2000),
    isActive: z.boolean(),
});

type MedicineFormValues = z.infer<typeof medicineSchema>;

const emptyValues: MedicineFormValues = {
    name: '',
    baseUnitName: 'Viên',
    barcode: '',
    registrationNumber: '',
    category: '',
    activeIngredient: '',
    strength: '',
    dosageForm: '',
    manufacturer: '',
    sellingPrice: 0,
    minStock: 0,
    requiresPrescription: false,
    description: '',
    isActive: true,
};

function MedicineDialog({
    open,
    onOpenChange,
    medicine,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    medicine: Medicine | null;
}) {
    const queryClient = useQueryClient();
    const { selectedStoreId } = useWorkspace();
    const form = useForm<MedicineFormValues>({
        resolver: zodResolver(medicineSchema),
        defaultValues: emptyValues,
    });
    const requiresPrescription = useWatch({
        control: form.control,
        name: 'requiresPrescription',
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (!open) return;
        form.reset(
            medicine
                ? {
                      name: medicine.name,
                      baseUnitName: medicine.baseUnitName,
                      barcode: medicine.barcode ?? '',
                      registrationNumber: medicine.registrationNumber ?? '',
                      category: medicine.category ?? '',
                      activeIngredient: medicine.activeIngredient ?? '',
                      strength: medicine.strength ?? '',
                      dosageForm: medicine.dosageForm ?? '',
                      manufacturer: medicine.manufacturer ?? '',
                      sellingPrice: medicine.sellingPrice,
                      minStock: medicine.minStock,
                      requiresPrescription: medicine.requiresPrescription,
                      description: medicine.description ?? '',
                      isActive: medicine.isActive,
                  }
                : emptyValues
        );
    }, [form, medicine, open]);

    const mutation = useMutation({
        mutationFn: (values: MedicineFormValues) => {
            const payload = {
                ...values,
                barcode: values.barcode || undefined,
                registrationNumber: values.registrationNumber || undefined,
                category: values.category || undefined,
                activeIngredient: values.activeIngredient || undefined,
                strength: values.strength || undefined,
                dosageForm: values.dosageForm || undefined,
                manufacturer: values.manufacturer || undefined,
                description: values.description || undefined,
            };
            return medicine
                ? workspaceService.updateMedicine(
                      selectedStoreId,
                      medicine.id,
                      payload
                  )
                : workspaceService.createMedicine(selectedStoreId, payload);
        },
        onSuccess: () => {
            toast.success(
                medicine ? 'Đã cập nhật thuốc' : 'Đã thêm thuốc vào quầy'
            );
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'medicines'],
            });
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'inventory'],
            });
            form.reset(emptyValues);
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(
                    error,
                    'Không thể lưu thuốc. Vui lòng kiểm tra lại.'
                )
            ),
    });

    const errors = form.formState.errors;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {medicine ? 'Cập nhật thuốc' : 'Thêm thuốc mới'}
                    </DialogTitle>
                    <DialogDescription>
                        Thông tin giá và định mức tồn được áp dụng riêng cho
                        quầy đang chọn.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="medicine-form"
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Tên thuốc"
                        required
                        error={errors.name?.message}
                    >
                        <Input
                            autoFocus
                            placeholder="Paracetamol 500mg"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field
                        label="Đơn vị cơ bản"
                        required
                        error={errors.baseUnitName?.message}
                    >
                        <Input
                            placeholder="Viên, chai, tuýp..."
                            {...form.register('baseUnitName')}
                        />
                    </Field>
                    <Field
                        label="Hoạt chất"
                        error={errors.activeIngredient?.message}
                    >
                        <Input
                            placeholder="Paracetamol"
                            {...form.register('activeIngredient')}
                        />
                    </Field>
                    <Field label="Hàm lượng" error={errors.strength?.message}>
                        <Input
                            placeholder="500 mg"
                            {...form.register('strength')}
                        />
                    </Field>
                    <Field label="Mã vạch" error={errors.barcode?.message}>
                        <Input
                            placeholder="Quét hoặc nhập mã vạch"
                            {...form.register('barcode')}
                        />
                    </Field>
                    <Field
                        label="Số đăng ký"
                        error={errors.registrationNumber?.message}
                    >
                        <Input
                            placeholder="VD-12345-24"
                            {...form.register('registrationNumber')}
                        />
                    </Field>
                    <Field label="Nhóm thuốc" error={errors.category?.message}>
                        <Input
                            placeholder="Giảm đau - hạ sốt"
                            {...form.register('category')}
                        />
                    </Field>
                    <Field
                        label="Dạng bào chế"
                        error={errors.dosageForm?.message}
                    >
                        <Input
                            placeholder="Viên nén"
                            {...form.register('dosageForm')}
                        />
                    </Field>
                    <Field
                        label="Nhà sản xuất"
                        error={errors.manufacturer?.message}
                    >
                        <Input
                            placeholder="Tên nhà sản xuất"
                            {...form.register('manufacturer')}
                        />
                    </Field>
                    <div className="hidden sm:block" />
                    <Field
                        label="Giá bán"
                        required
                        error={errors.sellingPrice?.message}
                    >
                        <Input
                            type="number"
                            min="0"
                            step="100"
                            inputMode="decimal"
                            {...form.register('sellingPrice', {
                                valueAsNumber: true,
                            })}
                        />
                    </Field>
                    <Field
                        label="Tồn tối thiểu"
                        error={errors.minStock?.message}
                    >
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="decimal"
                            {...form.register('minStock', {
                                valueAsNumber: true,
                            })}
                        />
                    </Field>
                    <Field
                        label="Ghi chú"
                        error={errors.description?.message}
                        className="sm:col-span-2"
                    >
                        <textarea
                            rows={3}
                            className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                            placeholder="Thông tin sử dụng nội bộ"
                            {...form.register('description')}
                        />
                    </Field>
                    <div className="flex flex-wrap gap-5 sm:col-span-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={requiresPrescription}
                                onCheckedChange={(checked) =>
                                    form.setValue(
                                        'requiresPrescription',
                                        checked === true,
                                        {
                                            shouldDirty: true,
                                        }
                                    )
                                }
                            />
                            Thuốc kê đơn
                        </label>
                        {medicine ? (
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
                                Đang kinh doanh
                            </label>
                        ) : null}
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
                        form="medicine-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        {medicine ? 'Lưu thay đổi' : 'Thêm thuốc'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function MedicinesPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(
        null
    );
    const debouncedSearch = useDebounce(search, 350);
    const { selectedStoreId, hasRole } = useWorkspace();
    const canManage = hasRole('manager');

    const medicinesQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'medicines',
            debouncedSearch,
            page,
        ],
        queryFn: () =>
            workspaceService.getMedicines(selectedStoreId, {
                search: debouncedSearch,
                page,
                limit: 20,
            }),
        enabled: Boolean(selectedStoreId),
    });

    const openCreate = () => {
        setEditingMedicine(null);
        setDialogOpen(true);
    };

    const openEdit = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Danh mục thuốc"
                description="Tra cứu thuốc, giá bán và định mức tồn của quầy."
                actions={
                    canManage ? (
                        <Button onClick={openCreate}>
                            <Plus />
                            Thêm thuốc
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
                        placeholder="Tìm tên, mã vạch, hoạt chất"
                    />
                    <p className="text-muted-foreground text-sm">
                        {formatNumber(medicinesQuery.data?.totalResults ?? 0)}{' '}
                        mặt hàng
                    </p>
                </div>

                {medicinesQuery.isPending ? (
                    <LoadingState />
                ) : medicinesQuery.isError ? (
                    <ErrorState onRetry={() => void medicinesQuery.refetch()} />
                ) : !medicinesQuery.data?.results.length ? (
                    <EmptyState
                        title={
                            search
                                ? 'Không tìm thấy thuốc phù hợp'
                                : 'Chưa có thuốc trong quầy'
                        }
                        description={
                            canManage
                                ? 'Thêm thuốc đầu tiên để bắt đầu nhập hàng và bán.'
                                : 'Liên hệ quản lý để bổ sung danh mục thuốc.'
                        }
                        action={
                            canManage && !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Thêm thuốc
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Thuốc
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã vạch
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá bán
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Tồn khả dụng
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Trạng thái
                                        </th>
                                        {canManage ? (
                                            <th className="w-16 px-4 py-3 text-right font-medium">
                                                Sửa
                                            </th>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {medicinesQuery.data.results.map(
                                        (medicine) => (
                                            <tr
                                                key={medicine.id}
                                                className="hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">
                                                        {medicine.name}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {[
                                                            medicine.activeIngredient,
                                                            medicine.strength,
                                                            medicine.dosageForm,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ') ||
                                                            'Chưa bổ sung mô tả'}
                                                    </p>
                                                </td>
                                                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                                                    {medicine.barcode || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatCurrency(
                                                        medicine.sellingPrice
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span
                                                        className={
                                                            medicine.availableStock <=
                                                            medicine.minStock
                                                                ? 'text-destructive font-semibold'
                                                                : 'font-medium'
                                                        }
                                                    >
                                                        {formatNumber(
                                                            medicine.availableStock
                                                        )}
                                                    </span>{' '}
                                                    <span className="text-muted-foreground">
                                                        {medicine.baseUnitName.toLowerCase()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <StatusBadge
                                                            tone={
                                                                medicine.isActive
                                                                    ? 'success'
                                                                    : 'neutral'
                                                            }
                                                        >
                                                            {medicine.isActive
                                                                ? 'Đang bán'
                                                                : 'Ngừng bán'}
                                                        </StatusBadge>
                                                        {medicine.requiresPrescription ? (
                                                            <StatusBadge tone="warning">
                                                                Kê đơn
                                                            </StatusBadge>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                {canManage ? (
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                openEdit(
                                                                    medicine
                                                                )
                                                            }
                                                            aria-label={`Sửa ${medicine.name}`}
                                                            title="Sửa thuốc"
                                                        >
                                                            <Edit3 />
                                                        </Button>
                                                    </td>
                                                ) : null}
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={medicinesQuery.data.page}
                            totalPages={medicinesQuery.data.totalPages}
                            totalResults={medicinesQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            {canManage ? (
                <MedicineDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    medicine={editingMedicine}
                />
            ) : null}
        </div>
    );
}
