import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    CheckCircle2,
    Eye,
    LoaderCircle,
    Plus,
    Trash2,
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
import { NumberInput } from '@/components/ui/number-input';
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    toDateInputValue,
} from '@/lib/utils';
import { getApiErrorMessage } from '../utils/api-error';
import { workspaceService } from '../services/workspace.service';
import type { ImportReceipt, Medicine } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import { MedicineDialog } from './MedicinesPage';
import { ImportMedicinePicker } from '../components/ImportMedicinePicker';
import {
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    PermissionDenied,
    RowNumberCell,
    RowNumberHead,
} from '../components/shared';
import { LIST_PAGE_SIZE } from '../constants/workspace.constants';

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
                quantity: z
                    .number({ error: 'Nhập số lượng' })
                    .int('Số lượng phải là số nguyên')
                    .positive('Số lượng phải lớn hơn 0'),
                importPrice: z
                    .number({ error: 'Nhập giá nhập' })
                    .int('Giá nhập phải là số nguyên')
                    .min(0, 'Giá nhập không được âm'),
                sellingPrice: z
                    .number()
                    .int('Giá bán phải là số nguyên')
                    .min(0, 'Giá bán không được âm')
                    .nullish(),
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
    quantity: 1,
    importPrice: 0,
    expiryDate: '',
    sellingPrice: null,
};

type MedicineById = Record<string, Medicine>;

function ImportReview({
    values,
    medicineById,
    supplierName,
}: {
    values: ImportFormValues;
    medicineById: MedicineById;
    supplierName: string | null;
}) {
    const total = values.items.reduce(
        (sum, item) => sum + item.quantity * item.importPrice,
        0
    );

    return (
        <div className="space-y-5">
            <dl className="border-border bg-muted/30 grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
                <div>
                    <dt className="text-muted-foreground text-xs">
                        Nhà cung cấp
                    </dt>
                    <dd className="font-medium">
                        {supplierName ?? 'Không chọn nhà cung cấp'}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground text-xs">Ngày nhập</dt>
                    <dd className="font-medium">
                        {formatDate(values.importedAt)}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground text-xs">Ghi chú</dt>
                    <dd className="font-medium break-words">
                        {values.note || '—'}
                    </dd>
                </div>
            </dl>

            <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
                {values.items.map((item, index) => {
                    const medicine = medicineById[item.medicineId];
                    const unit = medicine?.units.find(
                        (entry) => entry.id === item.unitId
                    );
                    const unitName = unit?.name.toLowerCase() ?? '';
                    const baseUnitName =
                        medicine?.baseUnitName.toLowerCase() ?? '';
                    const baseQuantity = unit
                        ? item.quantity * unit.conversionRate
                        : item.quantity;
                    const costPerBaseUnit = unit
                        ? item.importPrice / unit.conversionRate
                        : item.importPrice;
                    const priceChanged =
                        medicine !== undefined &&
                        item.sellingPrice != null &&
                        item.sellingPrice !== medicine.sellingPrice;
                    const belowCost =
                        priceChanged &&
                        item.sellingPrice != null &&
                        item.sellingPrice < costPerBaseUnit;

                    return (
                        <div
                            key={`${item.medicineId}-${index}`}
                            className="space-y-1.5 p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium break-words">
                                        <span className="text-muted-foreground mr-1.5 tabular-nums">
                                            {index + 1}.
                                        </span>
                                        {medicine?.name ?? 'Sản phẩm'}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        HSD {formatDate(item.expiryDate)}
                                    </p>
                                </div>
                                <p className="shrink-0 font-semibold">
                                    {formatCurrency(
                                        item.quantity * item.importPrice
                                    )}
                                </p>
                            </div>
                            <p className="text-sm">
                                {formatNumber(item.quantity)} {unitName} ×{' '}
                                {formatCurrency(item.importPrice)}
                                {unit && !unit.isBaseUnit ? (
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · nhập kho {formatNumber(
                                            baseQuantity
                                        )}{' '}
                                        {baseUnitName}
                                    </span>
                                ) : null}
                            </p>
                            {priceChanged && medicine ? (
                                <p
                                    className={
                                        belowCost
                                            ? 'text-destructive text-xs'
                                            : 'text-muted-foreground text-xs'
                                    }
                                >
                                    Giá bán / {baseUnitName}:{' '}
                                    {formatCurrency(medicine.sellingPrice)} →{' '}
                                    {formatCurrency(item.sellingPrice ?? 0)}
                                    {belowCost ? ' (thấp hơn giá vốn)' : ''}
                                </p>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="border-primary/20 bg-secondary flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        Tổng tiền nhập
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {values.items.length} dòng hàng
                    </p>
                </div>
                <p className="text-brand-navy text-2xl font-semibold">
                    {formatCurrency(total)}
                </p>
            </div>
            <p className="text-muted-foreground text-sm">
                Khi xác nhận, hệ thống tạo lô hàng và cộng ngay vào tồn kho.
            </p>
        </div>
    );
}

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
                    sum + (item.quantity ?? 0) * (item.importPrice ?? 0),
                0
            ),
        [items]
    );
    const fields = useFieldArray({ control: form.control, name: 'items' });
    const [reviewing, setReviewing] = useState(false);
    // Picker results are paged by search, so the selected products are kept here for pricing and review.
    const [medicineById, setMedicineById] = useState<MedicineById>({});
    const [newProductRow, setNewProductRow] = useState<{
        index: number;
        name: string;
    } | null>(null);
    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setReviewing(false);
            setNewProductRow(null);
            setMedicineById({});
        }
        onOpenChange(nextOpen);
    };
    const supplierId = useWatch({ control: form.control, name: 'supplierId' });

    const suppliersQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'suppliers', 'options'],
        queryFn: () =>
            workspaceService.getSuppliers(selectedStoreId, {
                page: 1,
                limit: 100,
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

    const selectMedicine = (
        index: number,
        medicine: Medicine,
        amounts?: { quantity: number; importPrice: number; expiryDate: string }
    ) => {
        setMedicineById((current) => ({ ...current, [medicine.id]: medicine }));
        form.setValue(`items.${index}.medicineId`, medicine.id, {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue(
            `items.${index}.unitId`,
            medicine.units.find((unit) => unit.isBaseUnit)?.id ?? '',
            { shouldDirty: true, shouldValidate: true }
        );
        form.setValue(`items.${index}.sellingPrice`, medicine.sellingPrice);
        if (amounts) {
            form.setValue(`items.${index}.quantity`, amounts.quantity, {
                shouldDirty: true,
                shouldValidate: true,
            });
            form.setValue(`items.${index}.importPrice`, amounts.importPrice, {
                shouldDirty: true,
                shouldValidate: true,
            });
            form.setValue(`items.${index}.expiryDate`, amounts.expiryDate, {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
    };

    const buildPayload = (values: ImportFormValues) => ({
        ...values,
        supplierId: values.supplierId || null,
        note: values.note || undefined,
        items: values.items.map(({ sellingPrice, ...item }) => {
            const current = medicineById[item.medicineId]?.sellingPrice;
            return {
                ...item,
                sellingPrice:
                    sellingPrice != null && sellingPrice !== current
                        ? sellingPrice
                        : undefined,
            };
        }),
    });

    const mutation = useMutation({
        mutationFn: (values: ImportFormValues) =>
            workspaceService.createImport(
                selectedStoreId,
                buildPayload(values)
            ),
        onSuccess: () => {
            toast.success('Đã nhập kho');
            for (const key of [
                'imports',
                'medicines',
                'inventory',
                'dashboard',
            ]) {
                void queryClient.invalidateQueries({
                    queryKey: ['workspace', selectedStoreId, key],
                });
            }
            form.reset();
            handleOpenChange(false);
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể nhập kho.')),
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {reviewing ? 'Xác nhận phiếu nhập' : 'Tạo phiếu nhập'}
                    </DialogTitle>
                    <DialogDescription>
                        {reviewing
                            ? 'Bước 2/2 · Kiểm tra lại thông tin trước khi nhập kho.'
                            : 'Bước 1/2 · Nhập thông tin lô hàng, sau đó xem lại trước khi nhập kho.'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="import-form"
                    hidden={reviewing}
                    className="space-y-5"
                    onSubmit={form.handleSubmit(() => setReviewing(true))}
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
                                    Mỗi dòng tạo một lô tồn theo hạn sử dụng.
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
                                    medicineById[
                                        items[index]?.medicineId ?? ''
                                    ];
                                const selectedUnit =
                                    selectedMedicine?.units.find(
                                        (unit) =>
                                            unit.id === items[index]?.unitId
                                    );
                                const baseUnitLabel =
                                    selectedMedicine?.baseUnitName.toLowerCase() ??
                                    'đơn vị nhỏ nhất';
                                const costPerBaseUnit =
                                    selectedUnit &&
                                    items[index]?.importPrice != null
                                        ? items[index].importPrice /
                                          selectedUnit.conversionRate
                                        : null;
                                const sellingPrice =
                                    items[index]?.sellingPrice ?? null;
                                const belowCost =
                                    costPerBaseUnit !== null &&
                                    sellingPrice !== null &&
                                    sellingPrice < costPerBaseUnit;
                                const priceChanged =
                                    selectedMedicine !== undefined &&
                                    sellingPrice !== null &&
                                    sellingPrice !==
                                        selectedMedicine.sellingPrice;
                                const pricingHint = !selectedMedicine
                                    ? ''
                                    : [
                                          costPerBaseUnit !== null
                                              ? `Giá vốn ${formatCurrency(costPerBaseUnit)}/${baseUnitLabel}`
                                              : '',
                                          belowCost
                                              ? 'thấp hơn giá vốn'
                                              : costPerBaseUnit &&
                                                  sellingPrice !== null
                                                ? `lãi ${formatNumber(Math.round(((sellingPrice - costPerBaseUnit) / costPerBaseUnit) * 100))}%`
                                                : '',
                                          priceChanged
                                              ? `đổi từ ${formatCurrency(selectedMedicine.sellingPrice)} khi nhập kho`
                                              : '',
                                      ]
                                          .filter(Boolean)
                                          .join(' · ');
                                return (
                                    <div
                                        key={field.id}
                                        className="space-y-3 p-4"
                                    >
                                        <div className="grid items-start gap-3 lg:grid-cols-[minmax(180px,1fr)_140px_155px_36px]">
                                            <Field
                                                label="Sản phẩm"
                                                required
                                                error={
                                                    itemErrors?.medicineId
                                                        ?.message
                                                }
                                            >
                                                <ImportMedicinePicker
                                                    value={selectedMedicine}
                                                    rowLabel={`dòng ${index + 1}`}
                                                    invalid={Boolean(
                                                        itemErrors?.medicineId
                                                    )}
                                                    onSelect={(medicine) =>
                                                        selectMedicine(
                                                            index,
                                                            medicine
                                                        )
                                                    }
                                                    onCreateNew={(name) =>
                                                        setNewProductRow({
                                                            index,
                                                            name,
                                                        })
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                label="ĐVT"
                                                required
                                                error={
                                                    itemErrors?.unitId?.message
                                                }
                                            >
                                                <Controller
                                                    control={form.control}
                                                    name={`items.${index}.unitId`}
                                                    render={({
                                                        field: unitField,
                                                    }) => (
                                                        <select
                                                            className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 w-full rounded-md border px-2 text-sm outline-none focus:ring-3"
                                                            disabled={
                                                                !selectedMedicine
                                                            }
                                                            {...unitField}
                                                        >
                                                            <option value="">
                                                                Chọn ĐVT
                                                            </option>
                                                            {selectedMedicine?.units.map(
                                                                (unit) => (
                                                                    <option
                                                                        key={
                                                                            unit.id
                                                                        }
                                                                        value={
                                                                            unit.id
                                                                        }
                                                                    >
                                                                        {
                                                                            unit.name
                                                                        }
                                                                        {unit.isBaseUnit
                                                                            ? ''
                                                                            : ` (x${formatNumber(unit.conversionRate)})`}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>
                                                    )}
                                                />
                                            </Field>
                                            <Field
                                                label="Hạn sử dụng"
                                                required
                                                error={
                                                    itemErrors?.expiryDate
                                                        ?.message
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
                                                        fields.fields.length ===
                                                        1
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
                                        <div className="grid items-start gap-3 sm:grid-cols-3">
                                            <Field
                                                label="Số lượng"
                                                required
                                                error={
                                                    itemErrors?.quantity
                                                        ?.message
                                                }
                                            >
                                                <Controller
                                                    control={form.control}
                                                    name={`items.${index}.quantity`}
                                                    render={({
                                                        field: quantityField,
                                                    }) => (
                                                        <NumberInput
                                                            ref={
                                                                quantityField.ref
                                                            }
                                                            value={
                                                                quantityField.value
                                                            }
                                                            onValueChange={
                                                                quantityField.onChange
                                                            }
                                                            onBlur={
                                                                quantityField.onBlur
                                                            }
                                                            suffix={selectedUnit?.name.toLowerCase()}
                                                            aria-invalid={Boolean(
                                                                itemErrors?.quantity
                                                            )}
                                                        />
                                                    )}
                                                />
                                            </Field>
                                            <Field
                                                label={`Giá nhập / ${selectedUnit?.name.toLowerCase() ?? 'ĐVT'}`}
                                                required
                                                error={
                                                    itemErrors?.importPrice
                                                        ?.message
                                                }
                                            >
                                                <Controller
                                                    control={form.control}
                                                    name={`items.${index}.importPrice`}
                                                    render={({
                                                        field: priceField,
                                                    }) => (
                                                        <NumberInput
                                                            ref={priceField.ref}
                                                            value={
                                                                priceField.value
                                                            }
                                                            onValueChange={
                                                                priceField.onChange
                                                            }
                                                            onBlur={
                                                                priceField.onBlur
                                                            }
                                                            suffix="VND"
                                                            aria-invalid={Boolean(
                                                                itemErrors?.importPrice
                                                            )}
                                                        />
                                                    )}
                                                />
                                            </Field>
                                            <div className="grid gap-1.5">
                                                <Field
                                                    label={`Giá bán / ${baseUnitLabel}`}
                                                    error={
                                                        itemErrors?.sellingPrice
                                                            ?.message
                                                    }
                                                >
                                                    <Controller
                                                        control={form.control}
                                                        name={`items.${index}.sellingPrice`}
                                                        render={({
                                                            field: sellingField,
                                                        }) => (
                                                            <NumberInput
                                                                ref={
                                                                    sellingField.ref
                                                                }
                                                                value={
                                                                    sellingField.value
                                                                }
                                                                onValueChange={
                                                                    sellingField.onChange
                                                                }
                                                                onBlur={
                                                                    sellingField.onBlur
                                                                }
                                                                disabled={
                                                                    !selectedMedicine
                                                                }
                                                                suffix="VND"
                                                                placeholder="Giữ giá hiện tại"
                                                                aria-invalid={
                                                                    belowCost
                                                                }
                                                            />
                                                        )}
                                                    />
                                                </Field>
                                                {pricingHint ? (
                                                    <p
                                                        className={
                                                            belowCost
                                                                ? 'text-destructive text-xs'
                                                                : 'text-muted-foreground text-xs'
                                                        }
                                                    >
                                                        {pricingHint}
                                                    </p>
                                                ) : null}
                                            </div>
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

                {reviewing ? (
                    <ImportReview
                        values={form.getValues()}
                        medicineById={medicineById}
                        supplierName={
                            suppliersQuery.data?.results.find(
                                (supplier) => supplier.id === supplierId
                            )?.name ?? null
                        }
                    />
                ) : null}

                <DialogFooter>
                    {reviewing ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={mutation.isPending}
                                onClick={() => setReviewing(false)}
                            >
                                <ArrowLeft />
                                Quay lại chỉnh sửa
                            </Button>
                            <Button
                                type="button"
                                disabled={mutation.isPending}
                                onClick={() =>
                                    mutation.mutate(form.getValues())
                                }
                            >
                                {mutation.isPending ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <CheckCircle2 />
                                )}
                                Xác nhận nhập kho
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                            >
                                Hủy
                            </Button>
                            <Button form="import-form" type="submit">
                                Xem lại phiếu nhập
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
            {newProductRow ? (
                <MedicineDialog
                    open
                    onOpenChange={(nextOpen) => {
                        if (!nextOpen) setNewProductRow(null);
                    }}
                    medicine={null}
                    initialName={newProductRow.name}
                    onCreated={(medicine, amounts) => {
                        if (!medicine.isActive) {
                            toast.warning(
                                'Sản phẩm đang ở trạng thái ngừng bán nên chưa thể nhập kho.'
                            );
                            return;
                        }
                        selectMedicine(newProductRow.index, medicine, amounts);
                    }}
                />
            ) : null}
        </Dialog>
    );
}

const PREVIEW_PRODUCT_COUNT = 2;

// Shows the first products of a receipt; long names are truncated and the full list stays in the tooltip.
function ReceiptProducts({ details }: { details: ImportReceipt['details'] }) {
    const names = [...new Set(details.map((detail) => detail.medicine.name))];
    const hiddenCount = names.length - PREVIEW_PRODUCT_COUNT;

    return (
        <div
            className="w-56 max-w-56 lg:w-72 lg:max-w-72"
            title={names.join('\n')}
        >
            {names.slice(0, PREVIEW_PRODUCT_COUNT).map((name) => (
                <p key={name} className="truncate font-medium">
                    {name}
                </p>
            ))}
            {hiddenCount > 0 ? (
                <p className="text-muted-foreground text-xs">
                    +{formatNumber(hiddenCount)} sản phẩm khác
                </p>
            ) : null}
        </div>
    );
}

function ImportDetailDialog({
    receipt,
    onClose,
}: {
    receipt: ImportReceipt | null;
    onClose: () => void;
}) {
    if (!receipt) return null;

    return (
        <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        Phiếu nhập #{receipt.id.slice(0, 8).toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                        Lập lúc {formatDateTime(receipt.createdAt)} bởi{' '}
                        {receipt.createdByUser.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted/45 grid gap-3 rounded-lg p-4 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                        <p className="text-muted-foreground">Nhà cung cấp</p>
                        <p className="mt-1 font-medium break-words">
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
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                            <tr>
                                <RowNumberHead />
                                <th className="px-4 py-3 font-medium">
                                    Sản phẩm
                                </th>
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
                                    Giá bán
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Thành tiền
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                            {receipt.details.map((detail, index) => (
                                <tr key={detail.id}>
                                    <RowNumberCell index={index} />
                                    <td className="px-4 py-3 font-medium">
                                        <p className="line-clamp-2 max-w-64 min-w-40 break-words">
                                            {detail.medicine.name}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatDate(detail.expiryDate)}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {detail.newSellingPrice != null ? (
                                            <>
                                                {formatCurrency(
                                                    detail.newSellingPrice
                                                )}{' '}
                                                /{' '}
                                                {detail.medicine.baseUnitName.toLowerCase()}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
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
                    <p className="border-border rounded-lg border px-4 py-3 text-sm break-words">
                        <span className="font-medium">Ghi chú:</span>{' '}
                        {receipt.note}
                    </p>
                ) : null}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ImportsPage() {
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] =
        useState<ImportReceipt | null>(null);
    const { selectedStoreId, hasRole, canImport } = useWorkspace();

    const importsQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'imports', page],
        queryFn: () =>
            workspaceService.getImports(selectedStoreId, {
                status: 'completed',
                page,
                limit: LIST_PAGE_SIZE,
            }),
        enabled: Boolean(selectedStoreId) && hasRole('manager'),
    });

    if (!hasRole('manager')) return <PermissionDenied />;

    const importActions = (
        <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Nhập hàng
        </Button>
    );

    return (
        <div className="space-y-5">
            <PageHeader
                title="Nhập hàng"
                description="Tìm sản phẩm đã có trong quầy để nhập thêm; nếu chưa có, thêm sản phẩm mới ngay trên phiếu nhập."
                actions={canImport ? importActions : undefined}
            />

            <Panel className="overflow-hidden">
                <div className="border-border flex items-center justify-between gap-3 border-b p-4">
                    <h2 className="text-sm font-semibold">Lịch sử nhập kho</h2>
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
                        title="Chưa có phiếu nhập"
                        description="Lập phiếu nhập đầu tiên để tiếp nhận lô hàng vào kho."
                        action={canImport ? importActions : undefined}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <RowNumberHead />
                                        <th className="px-4 py-3 font-medium">
                                            Mã phiếu
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Ngày nhập
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhà cung cấp
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Sản phẩm
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Tổng tiền
                                        </th>
                                        <th className="w-16 px-4 py-3 text-right font-medium">
                                            Xem
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {importsQuery.data.results.map(
                                        (receipt, index) => {
                                            const supplierName =
                                                receipt.supplier?.name ??
                                                receipt.supplierNameSnapshot ??
                                                'Không ghi nhận';
                                            return (
                                                <tr
                                                    key={receipt.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <RowNumberCell
                                                        index={index}
                                                        pagination={
                                                            importsQuery.data
                                                        }
                                                    />
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
                                                        <p
                                                            className="line-clamp-2 max-w-56 min-w-36 break-words"
                                                            title={supplierName}
                                                        >
                                                            {supplierName}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <ReceiptProducts
                                                            details={
                                                                receipt.details
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">
                                                        {formatCurrency(
                                                            receipt.totalAmount
                                                        )}
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

            {canImport && (
                <CreateImportDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                />
            )}
            <ImportDetailDialog
                receipt={selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
            />
        </div>
    );
}
