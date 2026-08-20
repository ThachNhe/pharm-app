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
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { getApiErrorMessage } from '../utils/api-error';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { workspaceService } from '../services/workspace.service';
import type { InventoryMedicine, Medicine, ReferenceProduct } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import { ProductCategoryDialog } from '../components/ProductCategoryDialog';
import { ProductCategorySelect } from '../components/ProductCategorySelect';
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

const medicineSchema = z
    .object({
        categoryId: z.string().min(1, 'Chọn nhóm hàng hóa'),
        code: z.string().trim().min(1, 'Nhập mã hàng hóa').max(50),
        positionName: z.string().trim().max(255),
        name: z.string().trim().min(1, 'Nhập tên thuốc').max(255),
        baseUnitName: z.string().trim().min(1, 'Nhập đơn vị cơ bản').max(50),
        barcode: z.string().trim().max(100),
        secondaryBarcode: z.string().trim().max(100),
        registrationNumber: z.string().trim().max(100),
        activeIngredient: z.string().trim().max(255),
        strength: z.string().trim().max(100),
        dosageForm: z.string().trim().max(100),
        manufacturer: z.string().trim().max(255),
        countryOfOrigin: z.string().trim().max(100),
        importerName: z.string().trim().max(255),
        specification: z.string().trim().max(2000),
        usageInstructions: z.string().trim().max(2000),
        sellingPrice: z
            .number({ error: 'Nhập giá bán hợp lệ' })
            .min(0, 'Giá bán không được âm'),
        minStock: z
            .number({ error: 'Nhập tồn tối thiểu hợp lệ' })
            .min(0, 'Tồn tối thiểu không được âm'),
        requiresPrescription: z.boolean(),
        description: z.string().trim().max(2000),
        isActive: z.boolean(),
    })
    .refine(
        (values) =>
            !values.barcode ||
            !values.secondaryBarcode ||
            values.barcode !== values.secondaryBarcode,
        {
            path: ['secondaryBarcode'],
            message: 'Mã vạch 2 phải khác mã vạch chính',
        }
    );

type MedicineFormValues = z.infer<typeof medicineSchema>;

const emptyValues: MedicineFormValues = {
    categoryId: '',
    code: '',
    positionName: '',
    name: '',
    baseUnitName: 'Viên',
    barcode: '',
    secondaryBarcode: '',
    registrationNumber: '',
    activeIngredient: '',
    strength: '',
    dosageForm: '',
    manufacturer: '',
    countryOfOrigin: '',
    importerName: '',
    specification: '',
    usageInstructions: '',
    sellingPrice: 0,
    minStock: 0,
    requiresPrescription: false,
    description: '',
    isActive: true,
};

const getMedicineValues = (medicine: Medicine): MedicineFormValues => ({
    categoryId: medicine.categoryId,
    code: medicine.code,
    positionName: medicine.positionName ?? '',
    name: medicine.name,
    baseUnitName: medicine.baseUnitName,
    barcode: medicine.barcode ?? '',
    secondaryBarcode: medicine.secondaryBarcode ?? '',
    registrationNumber: medicine.registrationNumber ?? '',
    activeIngredient: medicine.activeIngredient ?? '',
    strength: medicine.strength ?? '',
    dosageForm: medicine.dosageForm ?? '',
    manufacturer: medicine.manufacturer ?? '',
    countryOfOrigin: medicine.countryOfOrigin ?? '',
    importerName: medicine.importerName ?? '',
    specification: medicine.specification ?? '',
    usageInstructions: medicine.usageInstructions ?? '',
    sellingPrice: medicine.sellingPrice,
    minStock: medicine.minStock,
    requiresPrescription: medicine.requiresPrescription,
    description: medicine.description ?? '',
    isActive: medicine.isActive,
});

const getNextSaleBatch = (medicine: InventoryMedicine) =>
    medicine.batches.find((batch) => !batch.isExpired);

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
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
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
    const categoryId = useWatch({ control: form.control, name: 'categoryId' });
    const categoriesQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'product-categories',
            'picker',
        ],
        queryFn: () =>
            workspaceService.getProductCategories(selectedStoreId, {
                page: 1,
                limit: 100,
            }),
        enabled: open && Boolean(selectedStoreId),
    });
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
        const matchingCategory = categoriesQuery.data?.results.find(
            (category) =>
                category.isActive &&
                category.name.localeCompare(product.categoryName ?? '', 'vi', {
                    sensitivity: 'accent',
                }) === 0
        );
        form.reset({
            ...emptyValues,
            categoryId: matchingCategory?.id ?? '',
            code: product.code ?? '',
            positionName: product.positionName ?? '',
            name: product.name,
            baseUnitName: product.unitName ?? emptyValues.baseUnitName,
            barcode: product.barcode ?? product.secondaryBarcode ?? '',
            secondaryBarcode:
                product.secondaryBarcode &&
                product.secondaryBarcode !== product.barcode
                    ? product.secondaryBarcode
                    : '',
            registrationNumber: product.registrationNumber ?? '',
            activeIngredient: product.activeIngredient ?? '',
            manufacturer: product.manufacturer ?? '',
            countryOfOrigin: product.countryOfOrigin ?? '',
            importerName: product.importerName ?? '',
            specification: product.specification ?? '',
            usageInstructions: product.usageInstructions ?? '',
            minStock: product.minInventory ?? 0,
        });
    };

    const mutation = useMutation({
        mutationFn: (values: MedicineFormValues) => {
            if (medicine?.referenceProductId) {
                return workspaceService.updateMedicine(
                    selectedStoreId,
                    medicine.id,
                    {
                        categoryId: values.categoryId,
                        code: values.code,
                        positionName: values.positionName || undefined,
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
                secondaryBarcode: values.secondaryBarcode || undefined,
                registrationNumber: values.registrationNumber || undefined,
                activeIngredient: values.activeIngredient || undefined,
                strength: values.strength || undefined,
                dosageForm: values.dosageForm || undefined,
                manufacturer: values.manufacturer || undefined,
                countryOfOrigin: values.countryOfOrigin || undefined,
                importerName: values.importerName || undefined,
                specification: values.specification || undefined,
                usageInstructions: values.usageInstructions || undefined,
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

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setCategoryDialogOpen(false);
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {medicine ? 'Cập nhật thuốc' : 'Thêm thuốc mới'}
                    </DialogTitle>
                    <DialogDescription>
                        {sharedDetailsLocked
                            ? 'Thông tin thuốc từ thư viện được dùng chung; mã hàng hóa, nhóm, vị trí, giá và tồn tối thiểu được cấu hình riêng cho quầy.'
                            : 'Mã hàng hóa, vị trí, giá và định mức tồn được áp dụng riêng cho quầy đang chọn.'}
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
                            label="Mã hàng hóa"
                            required
                            error={errors.code?.message}
                        >
                            <Input
                                autoFocus
                                placeholder="SP000042"
                                {...form.register('code')}
                            />
                        </Field>
                        <Field
                            label="Tên thuốc"
                            required
                            error={errors.name?.message}
                        >
                            <Input
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
                                readOnly={sharedDetailsLocked}
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
                            label="Mã vạch 2"
                            error={errors.secondaryBarcode?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Mã vạch phụ (nếu có)"
                                {...form.register('secondaryBarcode')}
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
                        <div className="grid gap-1.5 text-sm">
                            <span className="font-medium">
                                Nhóm hàng hóa
                                <span className="text-destructive ml-1">*</span>
                            </span>
                            <input
                                type="hidden"
                                {...form.register('categoryId')}
                            />
                            <div className="flex gap-2">
                                <ProductCategorySelect
                                    value={categoryId}
                                    categories={
                                        categoriesQuery.data?.results ?? []
                                    }
                                    onChange={(value) =>
                                        form.setValue('categoryId', value, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        })
                                    }
                                    disabled={categoriesQuery.isPending}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() => setCategoryDialogOpen(true)}
                                    aria-label="Thêm nhóm sản phẩm"
                                    title="Thêm nhóm sản phẩm"
                                >
                                    <Plus />
                                </Button>
                            </div>
                            {categoriesQuery.isError ? (
                                <button
                                    type="button"
                                    className="text-destructive w-fit text-xs underline"
                                    onClick={() =>
                                        void categoriesQuery.refetch()
                                    }
                                >
                                    Không tải được danh sách nhóm. Thử lại
                                </button>
                            ) : null}
                            {errors.categoryId?.message ? (
                                <span className="text-destructive text-xs">
                                    {errors.categoryId.message}
                                </span>
                            ) : null}
                        </div>
                        <Field
                            label="Dạng bào chế"
                            error={errors.dosageForm?.message}
                        >
                            <Input
                                readOnly={sharedDetailsLocked}
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
                        <Field
                            label="Nước sản xuất"
                            error={errors.countryOfOrigin?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Việt Nam"
                                {...form.register('countryOfOrigin')}
                            />
                        </Field>
                        <Field
                            label="Nhà nhập khẩu"
                            error={errors.importerName?.message}
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Tên đơn vị nhập khẩu"
                                {...form.register('importerName')}
                            />
                        </Field>
                        <Field
                            label="Vị trí tại quầy"
                            error={errors.positionName?.message}
                        >
                            <Input
                                placeholder="Kệ A1"
                                {...form.register('positionName')}
                            />
                        </Field>
                        <Field
                            label="Quy cách"
                            error={errors.specification?.message}
                            className="sm:col-span-2"
                        >
                            <Input
                                readOnly={referenceDetailsLocked}
                                placeholder="Hộp 10 vỉ x 10 viên"
                                {...form.register('specification')}
                            />
                        </Field>
                        <Field
                            label="Hướng dẫn sử dụng"
                            error={errors.usageInstructions?.message}
                            className="sm:col-span-2"
                        >
                            <textarea
                                readOnly={referenceDetailsLocked}
                                rows={3}
                                className="border-input focus:border-ring focus:ring-ring/20 read-only:bg-muted/40 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none read-only:cursor-default focus:ring-3"
                                placeholder="Cách dùng và liều dùng"
                                {...form.register('usageInstructions')}
                            />
                        </Field>
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
                                readOnly={sharedDetailsLocked}
                                rows={3}
                                className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                                placeholder="Thông tin sử dụng nội bộ"
                                {...form.register('description')}
                            />
                        </Field>
                        <div className="flex flex-wrap gap-5 sm:col-span-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    disabled={sharedDetailsLocked}
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
            {categoryDialogOpen ? (
                <ProductCategoryDialog
                    open
                    onOpenChange={setCategoryDialogOpen}
                    onSaved={(category) =>
                        form.setValue('categoryId', category.id, {
                            shouldDirty: true,
                            shouldValidate: true,
                        })
                    }
                />
            ) : null}
        </Dialog>
    );
}

export function MedicinesPage() {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(
        null
    );
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
                description="Tra cứu thông tin bán hàng, lô FEFO, giá và tồn kho của quầy."
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
                        onChange={setSearch}
                        placeholder="Tìm mã, tên, mã vạch, hoạt chất, vị trí"
                    />
                    <p className="text-muted-foreground text-sm">
                        {formatNumber(medicinesQuery.data?.totalResults ?? 0)}{' '}
                        mặt hàng
                    </p>
                </div>
                <div className="bg-secondary/35 text-muted-foreground border-border border-b px-4 py-2.5 text-xs">
                    Lô và hạn dùng hiển thị theo lô còn hạn được ưu tiên bán
                    trước (FEFO). Số lượng là tổng tồn khả dụng tại quầy.
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
                        <div
                            className="overflow-x-auto"
                            tabIndex={0}
                            aria-label="Bảng sản phẩm đang bán tại quầy"
                        >
                            <table className="w-full min-w-[2600px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="bg-muted sticky left-0 z-20 w-16 min-w-16 px-4 py-3 text-right font-medium">
                                            STT
                                        </th>
                                        <th className="bg-muted sticky left-16 z-20 w-32 min-w-32 px-4 py-3 font-medium">
                                            Mã
                                        </th>
                                        <th className="bg-muted sticky left-48 z-20 w-80 min-w-80 px-4 py-3 font-medium">
                                            Tên sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            ĐVT
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Lô bán trước
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hạn dùng
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Số lượng
                                        </th>
                                        {canManage ? (
                                            <th className="px-4 py-3 text-right font-medium">
                                                Giá nhập
                                            </th>
                                        ) : null}
                                        <th className="px-4 py-3 text-right font-medium">
                                            Giá bán lẻ
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Số đăng ký
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Mã vạch
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Kê đơn
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hoạt chất
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Hãng sản xuất
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Nhóm sản phẩm
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Vị trí
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
                                        (medicine, index) => {
                                            const nextBatch =
                                                getNextSaleBatch(medicine);
                                            return (
                                                <tr
                                                    key={medicine.id}
                                                    className="group hover:bg-muted/30"
                                                >
                                                    <td className="bg-card group-hover:bg-muted sticky left-0 z-10 w-16 min-w-16 px-4 py-3 text-right transition-colors">
                                                        {(medicinesQuery.data
                                                            .page -
                                                            1) *
                                                            medicinesQuery.data
                                                                .limit +
                                                            index +
                                                            1}
                                                    </td>
                                                    <td
                                                        className="bg-card group-hover:bg-muted sticky left-16 z-10 w-32 max-w-32 min-w-32 truncate px-4 py-3 font-mono text-xs transition-colors"
                                                        title={medicine.code}
                                                    >
                                                        {medicine.code}
                                                    </td>
                                                    <td className="bg-card group-hover:bg-muted sticky left-48 z-10 w-80 max-w-80 min-w-80 px-4 py-3 transition-colors">
                                                        <p
                                                            className="line-clamp-2 font-medium"
                                                            title={
                                                                medicine.name
                                                            }
                                                        >
                                                            {medicine.name}
                                                        </p>
                                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                                            {[
                                                                medicine.strength,
                                                                medicine.dosageForm,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ') ||
                                                                'Chưa bổ sung mô tả'}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {medicine.baseUnitName}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                                        {nextBatch?.batchNumber ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {nextBatch
                                                            ? formatDate(
                                                                  nextBatch.expiryDate
                                                              )
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
                                                    {canManage ? (
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            {nextBatch?.importPrice ==
                                                            null
                                                                ? '—'
                                                                : formatCurrency(
                                                                      nextBatch.importPrice
                                                                  )}
                                                        </td>
                                                    ) : null}
                                                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                                        {formatCurrency(
                                                            medicine.sellingPrice
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {medicine.registrationNumber ||
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                                        {[
                                                            medicine.barcode,
                                                            medicine.secondaryBarcode,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' / ') || '—'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {medicine.requiresPrescription
                                                            ? 'Có'
                                                            : 'Không'}
                                                    </td>
                                                    <td className="max-w-64 px-4 py-3">
                                                        <span
                                                            className="line-clamp-2"
                                                            title={
                                                                medicine.activeIngredient ??
                                                                undefined
                                                            }
                                                        >
                                                            {medicine.activeIngredient ||
                                                                '—'}
                                                        </span>
                                                    </td>
                                                    <td className="max-w-64 px-4 py-3">
                                                        <span
                                                            className="line-clamp-2"
                                                            title={
                                                                medicine.manufacturer ??
                                                                undefined
                                                            }
                                                        >
                                                            {medicine.manufacturer ||
                                                                '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {medicine.category ||
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {medicine.positionName ||
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-3">
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
                                            );
                                        }
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
