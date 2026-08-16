import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Edit3, Library, LoaderCircle, Plus } from 'lucide-react';
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
import type { Medicine, ReferenceProduct } from '../types';
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

const getMedicineValues = (medicine: Medicine): MedicineFormValues => ({
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
});

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
    const [sourceMode, setSourceMode] = useState<'manual' | 'library'>(
        'manual'
    );
    const [librarySearch, setLibrarySearch] = useState('');
    const [selectedReferenceProduct, setSelectedReferenceProduct] =
        useState<ReferenceProduct | null>(null);
    const debouncedLibrarySearch = useDebounce(librarySearch, 350);
    const form = useForm<MedicineFormValues>({
        resolver: zodResolver(medicineSchema),
        defaultValues: medicine ? getMedicineValues(medicine) : emptyValues,
    });
    const requiresPrescription = useWatch({
        control: form.control,
        name: 'requiresPrescription',
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });
    const libraryQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'reference-products',
            'picker',
            debouncedLibrarySearch,
        ],
        queryFn: () =>
            workspaceService.getReferenceProducts(selectedStoreId, {
                search: debouncedLibrarySearch,
                page: 1,
                limit: 8,
            }),
        enabled:
            open &&
            !medicine &&
            sourceMode === 'library' &&
            debouncedLibrarySearch.trim().length >= 2,
    });

    const chooseSourceMode = (mode: 'manual' | 'library') => {
        setSourceMode(mode);
        setLibrarySearch('');
        setSelectedReferenceProduct(null);
        form.reset(emptyValues);
    };

    const chooseReferenceProduct = (product: ReferenceProduct) => {
        if (product.isAddedToStore) return;
        setSelectedReferenceProduct(product);
        form.reset({
            ...emptyValues,
            name: product.name,
            baseUnitName: product.unitName ?? emptyValues.baseUnitName,
            barcode: product.barcode ?? product.secondaryBarcode ?? '',
            registrationNumber: product.registrationNumber ?? '',
            category: product.categoryName ?? '',
            activeIngredient: product.activeIngredient ?? '',
            manufacturer: product.manufacturer ?? '',
            minStock: product.minInventory ?? 0,
            description: product.usageInstructions ?? '',
        });
    };

    const mutation = useMutation({
        mutationFn: (values: MedicineFormValues) => {
            if (medicine?.referenceProductId) {
                return workspaceService.updateMedicine(
                    selectedStoreId,
                    medicine.id,
                    {
                        sellingPrice: values.sellingPrice,
                        minStock: values.minStock,
                        isActive: values.isActive,
                    }
                );
            }
            const payload = {
                ...values,
                referenceProductId: selectedReferenceProduct?.id,
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
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'reference-products'],
            });
            form.reset(emptyValues);
            setSelectedReferenceProduct(null);
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
    const sharedDetailsLocked = Boolean(medicine?.referenceProductId);
    const referenceDetailsLocked =
        sharedDetailsLocked || Boolean(selectedReferenceProduct);
    const showForm =
        Boolean(medicine) ||
        sourceMode === 'manual' ||
        Boolean(selectedReferenceProduct);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {medicine ? 'Cập nhật thuốc' : 'Thêm thuốc mới'}
                    </DialogTitle>
                    <DialogDescription>
                        {sharedDetailsLocked
                            ? 'Thuốc từ thư viện dùng thông tin chung; bạn có thể cập nhật giá, tồn tối thiểu và trạng thái của quầy.'
                            : 'Thông tin giá và định mức tồn được áp dụng riêng cho quầy đang chọn.'}
                    </DialogDescription>
                </DialogHeader>
                {!medicine ? (
                    <div
                        className="bg-muted/50 grid grid-cols-2 gap-1 rounded-lg p-1"
                        role="group"
                        aria-label="Cách thêm thuốc"
                    >
                        <Button
                            type="button"
                            variant={
                                sourceMode === 'library' ? 'default' : 'ghost'
                            }
                            onClick={() => chooseSourceMode('library')}
                            aria-pressed={sourceMode === 'library'}
                        >
                            <Library />
                            Từ thư viện
                        </Button>
                        <Button
                            type="button"
                            variant={
                                sourceMode === 'manual' ? 'default' : 'ghost'
                            }
                            onClick={() => chooseSourceMode('manual')}
                            aria-pressed={sourceMode === 'manual'}
                        >
                            <Plus />
                            Nhập thủ công
                        </Button>
                    </div>
                ) : null}

                {!medicine &&
                sourceMode === 'library' &&
                !selectedReferenceProduct ? (
                    <div className="border-border space-y-3 rounded-lg border p-4">
                        <div>
                            <p className="text-sm font-medium">
                                Tìm trong thư viện thuốc
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                                Nhập ít nhất 2 ký tự của tên, mã nguồn hoặc
                                barcode.
                            </p>
                        </div>
                        <SearchInput
                            value={librarySearch}
                            onChange={setLibrarySearch}
                            placeholder="Tìm tên thuốc hoặc quét barcode"
                            className="sm:w-full"
                        />
                        {debouncedLibrarySearch.trim().length < 2 ? (
                            <p className="text-muted-foreground py-5 text-center text-sm">
                                Kết quả phù hợp sẽ xuất hiện tại đây.
                            </p>
                        ) : libraryQuery.isPending ? (
                            <div className="flex items-center justify-center gap-2 py-5 text-sm">
                                <LoaderCircle className="text-primary size-4 animate-spin" />
                                Đang tìm trong thư viện
                            </div>
                        ) : libraryQuery.isError ? (
                            <div className="py-4 text-center">
                                <p className="text-destructive text-sm">
                                    Không tải được thư viện thuốc.
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => void libraryQuery.refetch()}
                                >
                                    Thử lại
                                </Button>
                            </div>
                        ) : !libraryQuery.data?.results.length ? (
                            <p className="text-muted-foreground py-5 text-center text-sm">
                                Không tìm thấy sản phẩm phù hợp. Bạn có thể
                                chuyển sang nhập thủ công.
                            </p>
                        ) : (
                            <div className="border-border max-h-72 divide-y overflow-y-auto rounded-md border">
                                {libraryQuery.data.results.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        disabled={product.isAddedToStore}
                                        onClick={() =>
                                            chooseReferenceProduct(product)
                                        }
                                        className="hover:bg-muted/60 focus-visible:ring-ring flex w-full items-start justify-between gap-3 px-3 py-3 text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">
                                                {product.name}
                                            </span>
                                            <span className="text-muted-foreground mt-1 block text-xs">
                                                {[
                                                    product.code,
                                                    product.barcode,
                                                    product.manufacturer,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ') ||
                                                    'Chưa có thông tin bổ sung'}
                                            </span>
                                        </span>
                                        {product.isAddedToStore ? (
                                            <span className="text-success flex shrink-0 items-center gap-1 text-xs font-medium">
                                                <CheckCircle2 className="size-3.5" />
                                                Đã có
                                            </span>
                                        ) : (
                                            <span className="text-primary shrink-0 text-xs font-medium">
                                                Chọn
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {showForm ? (
                    <form
                        id="medicine-form"
                        className="grid gap-4 sm:grid-cols-2"
                        onSubmit={form.handleSubmit((values) =>
                            mutation.mutate(values)
                        )}
                    >
                        {selectedReferenceProduct ? (
                            <div className="border-primary/25 bg-secondary/45 flex items-start justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {selectedReferenceProduct.name}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {[
                                            selectedReferenceProduct.code,
                                            selectedReferenceProduct.specification,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ') ||
                                            'Sản phẩm từ thư viện'}
                                        {selectedReferenceProduct.referencePrice
                                            ? ` · Giá tham khảo ${formatCurrency(selectedReferenceProduct.referencePrice)}`
                                            : ''}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedReferenceProduct(null);
                                        form.reset(emptyValues);
                                    }}
                                >
                                    Đổi sản phẩm
                                </Button>
                            </div>
                        ) : null}
                        <Field
                            label="Tên thuốc"
                            required
                            error={errors.name?.message}
                        >
                            <Input
                                autoFocus
                                readOnly={referenceDetailsLocked}
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
                                readOnly={referenceDetailsLocked}
                                placeholder="Viên, chai, tuýp..."
                                {...form.register('baseUnitName')}
                            />
                        </Field>
                        <Field
                            label="Hoạt chất"
                            error={errors.activeIngredient?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Paracetamol"
                                {...form.register('activeIngredient')}
                            />
                        </Field>
                        <Field
                            label="Hàm lượng"
                            error={errors.strength?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="500 mg"
                                {...form.register('strength')}
                            />
                        </Field>
                        <Field label="Mã vạch" error={errors.barcode?.message}>
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Quét hoặc nhập mã vạch"
                                {...form.register('barcode')}
                            />
                        </Field>
                        <Field
                            label="Số đăng ký"
                            error={errors.registrationNumber?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="VD-12345-24"
                                {...form.register('registrationNumber')}
                            />
                        </Field>
                        <Field
                            label="Nhóm thuốc"
                            error={errors.category?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Giảm đau - hạ sốt"
                                {...form.register('category')}
                            />
                        </Field>
                        <Field
                            label="Dạng bào chế"
                            error={errors.dosageForm?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Viên nén"
                                {...form.register('dosageForm')}
                            />
                        </Field>
                        <Field
                            label="Nhà sản xuất"
                            error={errors.manufacturer?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
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
                                readOnly={referenceDetailsLocked}
                                rows={3}
                                className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                                placeholder="Thông tin sử dụng nội bộ"
                                {...form.register('description')}
                            />
                        </Field>
                        <div className="flex flex-wrap gap-5 sm:col-span-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    disabled={referenceDetailsLocked}
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
                ) : null}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        Hủy
                    </Button>
                    {showForm ? (
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
                    ) : null}
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

            {canManage && dialogOpen ? (
                <MedicineDialog
                    open
                    onOpenChange={setDialogOpen}
                    medicine={editingMedicine}
                />
            ) : null}
        </div>
    );
}
