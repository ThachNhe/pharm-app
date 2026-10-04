import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Controller,
    useFieldArray,
    useForm,
    useWatch,
    type Control,
    type DefaultValues,
} from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle2,
    Edit3,
    Library,
    LoaderCircle,
    Plus,
    Trash2,
} from 'lucide-react';
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
import { NumberInput } from '@/components/ui/number-input';
import { useDebounce } from '@/hooks/useDebounce';
import {
    formatCurrency,
    formatDate,
    formatNumber,
    toDateInputValue,
} from '@/lib/utils';
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

const COMMON_UNIT_NAMES = [
    'Viên',
    'Vỉ',
    'Hộp',
    'Chai',
    'Gói',
    'Ống',
    'Lọ',
    'Tuýp',
    'Thùng',
    'Kit',
];

const DEFAULT_BASE_UNIT_NAME = 'Viên';

const todayDate = new Date();
const today = toDateInputValue(todayDate);
const tomorrow = toDateInputValue(
    new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate() + 1
    )
);

const baseUnit = (name: string) => ({
    name,
    conversionRate: 1,
    isBaseUnit: true,
});

const medicineSchema = z
    .object({
        categoryId: z.string().min(1, 'Chọn nhóm hàng hóa'),
        code: z.string().trim().min(1, 'Nhập mã hàng hóa').max(50),
        positionName: z.string().trim().max(255),
        name: z.string().trim().min(1, 'Nhập tên sản phẩm').max(255),
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
        usageInstructions: z.string().trim().max(2000),
        sellingPrice: z
            .number({ error: 'Nhập giá bán' })
            .min(0, 'Giá bán không được âm'),
        minStock: z
            .number({ error: 'Nhập tồn tối thiểu' })
            .min(0, 'Tồn tối thiểu không được âm'),
        importPrice: z.number().min(0, 'Giá nhập không được âm').optional(),
        quantity: z.number().positive('Số lượng phải lớn hơn 0').optional(),
        batchNumber: z.string().trim().max(100),
        expiryDate: z.string(),
        requiresPrescription: z.boolean(),
        description: z.string().trim().max(2000),
        isActive: z.boolean(),
        units: z
            .array(
                z.object({
                    name: z.string().trim().min(1, 'Chọn đơn vị tính').max(50),
                    conversionRate: z
                        .number({ error: 'Nhập hệ số hợp lệ' })
                        .positive('Hệ số phải lớn hơn 0')
                        .multipleOf(0.01, 'Hệ số có tối đa 2 số thập phân'),
                    isBaseUnit: z.boolean(),
                })
            )
            .min(1)
            .max(10, 'Mỗi sản phẩm có tối đa 10 đơn vị tính'),
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
    )
    .superRefine((values, context) => {
        const baseUnits = values.units.filter((unit) => unit.isBaseUnit);
        if (
            baseUnits.length !== 1 ||
            baseUnits[0].name !== values.baseUnitName ||
            baseUnits[0].conversionRate !== 1
        ) {
            context.addIssue({
                code: 'custom',
                path: ['units'],
                message: 'Đơn vị nhỏ nhất phải có hệ số bằng 1',
            });
        }
        const names = values.units.map((unit) =>
            unit.name.trim().toLocaleLowerCase('vi')
        );
        if (new Set(names).size !== names.length) {
            context.addIssue({
                code: 'custom',
                path: ['units'],
                message: 'Tên đơn vị tính không được trùng nhau',
            });
        }
        values.units.forEach((unit, index) => {
            if (!unit.isBaseUnit && unit.conversionRate <= 1) {
                context.addIssue({
                    code: 'custom',
                    path: ['units', index, 'conversionRate'],
                    message: 'Hệ số phải lớn hơn 1',
                });
            }
        });
    });

// New products created by an importer are received into stock in the same request.
// `when` keeps these checks running while other fields are invalid, so every missing field shows at once.
const createMedicineSchema = (requireInitialImport: boolean) => {
    if (!requireInitialImport) return medicineSchema;
    const always = () => true;
    return medicineSchema
        .refine((values) => values.importPrice !== undefined, {
            path: ['importPrice'],
            message: 'Nhập giá nhập',
            when: always,
        })
        .refine((values) => values.quantity !== undefined, {
            path: ['quantity'],
            message: 'Nhập số lượng',
            when: always,
        })
        .refine((values) => Boolean(values.batchNumber?.trim()), {
            path: ['batchNumber'],
            message: 'Nhập số lô',
            when: always,
        })
        .refine((values) => Boolean(values.expiryDate), {
            path: ['expiryDate'],
            message: 'Chọn hạn dùng',
            when: always,
        })
        .refine((values) => !values.expiryDate || values.expiryDate > today, {
            path: ['expiryDate'],
            message: 'Hạn dùng phải sau hôm nay',
            when: always,
        });
};

type MedicineFormValues = z.infer<typeof medicineSchema>;

const emptyValues: DefaultValues<MedicineFormValues> = {
    categoryId: '',
    code: '',
    positionName: '',
    name: '',
    baseUnitName: DEFAULT_BASE_UNIT_NAME,
    barcode: '',
    secondaryBarcode: '',
    registrationNumber: '',
    activeIngredient: '',
    strength: '',
    dosageForm: '',
    manufacturer: '',
    countryOfOrigin: '',
    importerName: '',
    usageInstructions: '',
    sellingPrice: undefined,
    minStock: 0,
    importPrice: undefined,
    quantity: undefined,
    batchNumber: '',
    expiryDate: '',
    requiresPrescription: false,
    description: '',
    isActive: true,
    units: [baseUnit(DEFAULT_BASE_UNIT_NAME)],
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
    usageInstructions: medicine.usageInstructions ?? '',
    sellingPrice: medicine.sellingPrice,
    minStock: medicine.minStock,
    importPrice: undefined,
    quantity: undefined,
    batchNumber: '',
    expiryDate: '',
    requiresPrescription: medicine.requiresPrescription,
    description: medicine.description ?? '',
    isActive: medicine.isActive,
    units: medicine.units.length
        ? medicine.units.map((unit) => ({
              name: unit.name,
              conversionRate: unit.conversionRate,
              isBaseUnit: unit.isBaseUnit,
          }))
        : [baseUnit(medicine.baseUnitName)],
});

function NumberField({
    control,
    name,
    label,
    suffix,
    required,
    error,
}: {
    control: Control<MedicineFormValues>;
    name: 'sellingPrice' | 'minStock' | 'importPrice' | 'quantity';
    label: string;
    suffix: string;
    required?: boolean;
    error?: string;
}) {
    return (
        <Field label={label} required={required} error={error}>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <NumberInput
                        ref={field.ref}
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        suffix={suffix}
                        aria-invalid={Boolean(error)}
                    />
                )}
            />
        </Field>
    );
}

const getNextSaleBatch = (medicine: InventoryMedicine) =>
    medicine.batches.find((batch) => !batch.isExpired);

export function MedicineDialog({
    open,
    onOpenChange,
    medicine,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    medicine: Medicine | null;
}) {
    const queryClient = useQueryClient();
    const { selectedStoreId, canImport } = useWorkspace();
    const requireInitialImport = !medicine && canImport;
    const schema = useMemo(
        () => createMedicineSchema(requireInitialImport),
        [requireInitialImport]
    );
    const [sourceMode, setSourceMode] = useState<'manual' | 'library'>(
        'manual'
    );
    const [librarySearch, setLibrarySearch] = useState('');
    const [selectedReferenceProduct, setSelectedReferenceProduct] =
        useState<ReferenceProduct | null>(null);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [unitDialogOpen, setUnitDialogOpen] = useState(false);
    const [customUnitName, setCustomUnitName] = useState('');
    const [customUnitNames, setCustomUnitNames] = useState<string[]>([]);
    const debouncedLibrarySearch = useDebounce(librarySearch, 350);
    const form = useForm<MedicineFormValues>({
        resolver: zodResolver(schema),
        defaultValues: medicine ? getMedicineValues(medicine) : emptyValues,
    });
    const requiresPrescription = useWatch({
        control: form.control,
        name: 'requiresPrescription',
    });
    const code = useWatch({ control: form.control, name: 'code' });
    const isActive = useWatch({ control: form.control, name: 'isActive' });
    const categoryId = useWatch({ control: form.control, name: 'categoryId' });
    const baseUnitName = useWatch({
        control: form.control,
        name: 'baseUnitName',
    });
    const units = useWatch({ control: form.control, name: 'units' });
    const importPrice = useWatch({
        control: form.control,
        name: 'importPrice',
    });
    const quantity = useWatch({ control: form.control, name: 'quantity' });
    const unitFields = useFieldArray({ control: form.control, name: 'units' });
    const unitNames = [
        ...new Set([
            ...COMMON_UNIT_NAMES,
            ...customUnitNames,
            ...units.map((unit) => unit.name),
        ]),
    ];
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
    const generatedCodeQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'medicines', 'next-code'],
        queryFn: () => workspaceService.generateMedicineCode(selectedStoreId),
        enabled: open && !medicine && Boolean(selectedStoreId),
        gcTime: 0,
        retry: 1,
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

    useEffect(() => {
        if (!medicine && generatedCodeQuery.data?.code) {
            form.setValue('code', generatedCodeQuery.data.code, {
                shouldValidate: true,
            });
        }
    }, [form, generatedCodeQuery.data?.code, medicine]);

    const chooseSourceMode = (mode: 'manual' | 'library') => {
        setSourceMode(mode);
        setLibrarySearch('');
        setSelectedReferenceProduct(null);
        form.reset({
            ...emptyValues,
            code: form.getValues('code'),
        });
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
        const selectedBaseUnitName = product.unitName ?? DEFAULT_BASE_UNIT_NAME;
        form.reset({
            ...emptyValues,
            categoryId: matchingCategory?.id ?? '',
            code: form.getValues('code'),
            positionName: product.positionName ?? '',
            name: product.name,
            baseUnitName: selectedBaseUnitName,
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
            usageInstructions: product.usageInstructions ?? '',
            minStock: product.minInventory ?? 0,
            importPrice: product.inputPrice ?? undefined,
            units: product.medicineUnits.length
                ? product.medicineUnits.map((unit) => ({
                      name: unit.name,
                      conversionRate: unit.conversionRate,
                      isBaseUnit: unit.isBaseUnit,
                  }))
                : [baseUnit(selectedBaseUnitName)],
        });
    };

    const changeBaseUnit = (name: string) => {
        const nextUnits = [
            baseUnit(name),
            ...units
                .filter((unit) => !unit.isBaseUnit)
                .filter(
                    (unit) =>
                        unit.name.localeCompare(name, 'vi', {
                            sensitivity: 'accent',
                        }) !== 0
                ),
        ];
        form.setValue('baseUnitName', name, {
            shouldDirty: true,
            shouldValidate: true,
        });
        unitFields.replace(nextUnits);
    };

    const addCustomUnit = () => {
        const name = customUnitName.trim();
        if (!name) return;
        const existing = unitNames.find(
            (unitName) =>
                unitName.localeCompare(name, 'vi', {
                    sensitivity: 'accent',
                }) === 0
        );
        const selectedName = existing ?? name;
        if (!existing) setCustomUnitNames((current) => [...current, name]);
        changeBaseUnit(selectedName);
        setCustomUnitName('');
        setUnitDialogOpen(false);
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
                        units: values.units,
                    }
                );
            }
            const {
                importPrice: enteredImportPrice,
                quantity: enteredQuantity,
                batchNumber,
                expiryDate,
                ...productValues
            } = values;
            const payload = {
                ...productValues,
                code: values.code || undefined,
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
                usageInstructions: values.usageInstructions || undefined,
                description: values.description || undefined,
                initialImport:
                    requireInitialImport &&
                    enteredImportPrice !== undefined &&
                    enteredQuantity !== undefined
                        ? {
                              importPrice: enteredImportPrice,
                              quantity: enteredQuantity,
                              batchNumber,
                              expiryDate,
                          }
                        : undefined,
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
                medicine
                    ? 'Đã cập nhật sản phẩm'
                    : requireInitialImport
                      ? 'Đã thêm sản phẩm và nhập kho'
                      : 'Đã thêm sản phẩm vào quầy'
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
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'imports'],
            });
            form.reset(emptyValues);
            setSelectedReferenceProduct(null);
            onOpenChange(false);
        },
        onError: (error) => {
            const message = getApiErrorMessage(
                error,
                'Không thể lưu sản phẩm. Vui lòng kiểm tra lại.'
            );
            if (message.includes('Mã hàng hóa')) {
                form.setError('code', { message });
            }
            toast.error(message);
        },
    });

    const errors = form.formState.errors;
    const unitLabel = baseUnitName.toLowerCase();
    const sharedDetailsLocked = Boolean(medicine?.referenceProductId);
    const referenceDetailsLocked =
        sharedDetailsLocked || Boolean(selectedReferenceProduct);
    const isGeneratingCode = !medicine && generatedCodeQuery.isPending;
    const showForm =
        Boolean(medicine) ||
        sourceMode === 'manual' ||
        Boolean(selectedReferenceProduct);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setCategoryDialogOpen(false);
            setUnitDialogOpen(false);
        }
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {medicine
                            ? 'Cập nhật sản phẩm'
                            : requireInitialImport
                              ? 'Nhập hàng sản phẩm mới'
                              : 'Thêm sản phẩm mới'}
                    </DialogTitle>
                    <DialogDescription>
                        {sharedDetailsLocked
                            ? 'Thông tin thuốc từ thư viện được dùng chung; mã hàng hóa, nhóm, vị trí, giá và tồn tối thiểu được cấu hình riêng cho quầy.'
                            : requireInitialImport
                              ? 'Sản phẩm được thêm vào danh mục và nhập kho ngay, kèm một phiếu nhập đã hoàn tất.'
                              : 'Mã hàng hóa được gợi ý tự động và có thể chỉnh sửa; vị trí, giá và định mức tồn được áp dụng riêng cho quầy đang chọn.'}
                    </DialogDescription>
                </DialogHeader>
                {!medicine ? (
                    <div
                        className="bg-muted/50 grid grid-cols-2 gap-1 rounded-lg p-1"
                        role="group"
                        aria-label="Cách thêm sản phẩm"
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
                                        form.reset({
                                            ...emptyValues,
                                            code: form.getValues('code'),
                                        });
                                    }}
                                >
                                    Đổi sản phẩm
                                </Button>
                            </div>
                        ) : null}
                        <Field
                            label="Mã hàng hóa"
                            required
                            error={
                                errors.code?.message ??
                                (generatedCodeQuery.isError && !code
                                    ? 'Không thể tạo mã tự động. Hãy nhập mã thủ công.'
                                    : undefined)
                            }
                        >
                            <Input
                                autoFocus
                                readOnly={isGeneratingCode}
                                required
                                placeholder={
                                    isGeneratingCode
                                        ? 'Đang tạo mã...'
                                        : 'SP000338'
                                }
                                {...form.register('code')}
                            />
                        </Field>
                        <Field
                            label="Tên sản phẩm"
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
                            label="Đơn vị nhỏ nhất"
                            required
                            error={errors.baseUnitName?.message}
                        >
                            <input
                                type="hidden"
                                {...form.register('baseUnitName')}
                            />
                            <div className="flex gap-2">
                                <select
                                    value={baseUnitName}
                                    disabled={referenceDetailsLocked}
                                    onChange={(event) =>
                                        changeBaseUnit(event.target.value)
                                    }
                                    className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label="Đơn vị nhỏ nhất"
                                >
                                    {unitNames.map((unitName) => (
                                        <option key={unitName} value={unitName}>
                                            {unitName}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    disabled={referenceDetailsLocked}
                                    onClick={() => setUnitDialogOpen(true)}
                                    aria-label="Thêm đơn vị tính"
                                    title="Thêm đơn vị tính"
                                >
                                    <Plus />
                                </Button>
                            </div>
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
                        <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3 sm:col-span-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">
                                        Quy đổi đơn vị bán
                                    </p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        Tồn kho luôn lưu theo{' '}
                                        {baseUnitName.toLowerCase()}.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        unitFields.append({
                                            name:
                                                unitNames.find(
                                                    (name) =>
                                                        !units.some(
                                                            (unit) =>
                                                                unit.name ===
                                                                name
                                                        )
                                                ) ?? '',
                                            conversionRate: 10,
                                            isBaseUnit: false,
                                        })
                                    }
                                    disabled={unitFields.fields.length >= 10}
                                >
                                    <Plus />
                                    Thêm quy đổi
                                </Button>
                            </div>
                            {unitFields.fields.length === 1 ? (
                                <p className="text-muted-foreground text-xs">
                                    Ví dụ: 1 vỉ = 10 viên hoặc 1 hộp = 100 viên.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {unitFields.fields
                                        .slice(1)
                                        .map((field, offset) => {
                                            const index = offset + 1;
                                            const unitError =
                                                errors.units?.[index];
                                            return (
                                                <div
                                                    key={field.id}
                                                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_36px]"
                                                >
                                                    <div>
                                                        <select
                                                            className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 w-full rounded-md border px-3 text-sm outline-none focus:ring-3"
                                                            aria-label={`Đơn vị quy đổi ${index}`}
                                                            {...form.register(
                                                                `units.${index}.name`
                                                            )}
                                                        >
                                                            <option value="">
                                                                Chọn đơn vị
                                                            </option>
                                                            {unitNames.map(
                                                                (unitName) => (
                                                                    <option
                                                                        key={
                                                                            unitName
                                                                        }
                                                                        value={
                                                                            unitName
                                                                        }
                                                                    >
                                                                        {
                                                                            unitName
                                                                        }
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>
                                                        {unitError?.name
                                                            ?.message ? (
                                                            <p className="text-destructive mt-1 text-xs">
                                                                {
                                                                    unitError
                                                                        .name
                                                                        .message
                                                                }
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                min="1.01"
                                                                step="0.01"
                                                                inputMode="decimal"
                                                                className="pr-12"
                                                                aria-label={`Hệ số quy đổi ${index}`}
                                                                {...form.register(
                                                                    `units.${index}.conversionRate`,
                                                                    {
                                                                        valueAsNumber: true,
                                                                    }
                                                                )}
                                                            />
                                                            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                                                                x {baseUnitName}
                                                            </span>
                                                        </div>
                                                        {unitError
                                                            ?.conversionRate
                                                            ?.message ? (
                                                            <p className="text-destructive mt-1 text-xs">
                                                                {
                                                                    unitError
                                                                        .conversionRate
                                                                        .message
                                                                }
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            unitFields.remove(
                                                                index
                                                            )
                                                        }
                                                        aria-label={`Xóa đơn vị quy đổi ${index}`}
                                                        title="Xóa đơn vị quy đổi"
                                                    >
                                                        <Trash2 className="text-destructive" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                            {errors.units?.message ? (
                                <p className="text-destructive text-xs">
                                    {errors.units.message}
                                </p>
                            ) : null}
                        </div>
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
                        {requireInitialImport ? (
                            <>
                                <div className="border-border border-t pt-4 sm:col-span-2">
                                    <h3 className="text-sm font-semibold">
                                        Thông tin nhập hàng
                                    </h3>
                                    <p className="text-muted-foreground text-xs">
                                        Giá và số lượng tính theo {unitLabel},
                                        đơn vị nhỏ nhất của sản phẩm.
                                    </p>
                                </div>
                                <NumberField
                                    control={form.control}
                                    name="importPrice"
                                    label={`Giá nhập / ${unitLabel}`}
                                    suffix="VND"
                                    required
                                    error={errors.importPrice?.message}
                                />
                            </>
                        ) : null}
                        <NumberField
                            control={form.control}
                            name="sellingPrice"
                            label={`Giá bán / ${unitLabel}`}
                            suffix="VND"
                            required
                            error={errors.sellingPrice?.message}
                        />
                        {requireInitialImport ? (
                            <>
                                <NumberField
                                    control={form.control}
                                    name="quantity"
                                    label="Số lượng"
                                    suffix={unitLabel}
                                    required
                                    error={errors.quantity?.message}
                                />
                                <Field
                                    label="Số lô"
                                    required
                                    error={errors.batchNumber?.message}
                                >
                                    <Input
                                        placeholder="LO-2026-01"
                                        aria-invalid={Boolean(
                                            errors.batchNumber
                                        )}
                                        {...form.register('batchNumber')}
                                    />
                                </Field>
                                <Field
                                    label="Hạn sử dụng"
                                    required
                                    error={errors.expiryDate?.message}
                                >
                                    <Input
                                        type="date"
                                        min={tomorrow}
                                        aria-invalid={Boolean(
                                            errors.expiryDate
                                        )}
                                        {...form.register('expiryDate')}
                                    />
                                </Field>
                                <div className="border-primary/20 bg-secondary self-end rounded-lg border px-3 py-2">
                                    <p className="text-muted-foreground text-xs">
                                        Tổng tiền nhập
                                    </p>
                                    <p className="text-brand-navy text-base font-semibold">
                                        {formatCurrency(
                                            (importPrice ?? 0) * (quantity ?? 0)
                                        )}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <NumberField
                                control={form.control}
                                name="minStock"
                                label={`Tồn tối thiểu (${unitLabel})`}
                                suffix={unitLabel}
                                error={errors.minStock?.message}
                            />
                        )}
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
                            disabled={mutation.isPending || isGeneratingCode}
                        >
                            {mutation.isPending ? (
                                <LoaderCircle className="animate-spin" />
                            ) : null}
                            {medicine
                                ? 'Lưu thay đổi'
                                : requireInitialImport
                                  ? 'Thêm và nhập kho'
                                  : 'Thêm sản phẩm'}
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
            <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Thêm đơn vị tính</DialogTitle>
                        <DialogDescription>
                            Thêm tên đơn vị chưa có trong danh sách, ví dụ “Ống”
                            hoặc “Bình”.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Tên đơn vị" required>
                        <Input
                            autoFocus
                            maxLength={50}
                            value={customUnitName}
                            onChange={(event) =>
                                setCustomUnitName(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addCustomUnit();
                                }
                            }}
                            placeholder="Ví dụ: Bình"
                        />
                    </Field>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setUnitDialogOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            disabled={!customUnitName.trim()}
                            onClick={addCustomUnit}
                        >
                            Thêm đơn vị
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
                title="Danh mục sản phẩm"
                description="Tra cứu thông tin bán hàng, lô FEFO, giá và tồn kho của quầy."
                actions={
                    canManage ? (
                        <Button onClick={openCreate}>
                            <Plus />
                            Thêm sản phẩm
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
                                ? 'Không tìm thấy sản phẩm phù hợp'
                                : 'Chưa có sản phẩm trong quầy'
                        }
                        description={
                            canManage
                                ? 'Thêm sản phẩm đầu tiên để bắt đầu nhập hàng và bán.'
                                : 'Liên hệ quản lý để bổ sung danh mục sản phẩm.'
                        }
                        action={
                            canManage && !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Thêm sản phẩm
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
                                                        <p>
                                                            {
                                                                medicine.baseUnitName
                                                            }
                                                        </p>
                                                        {medicine.units.length >
                                                        1 ? (
                                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                                {medicine.units
                                                                    .filter(
                                                                        (
                                                                            unit
                                                                        ) =>
                                                                            !unit.isBaseUnit
                                                                    )
                                                                    .map(
                                                                        (
                                                                            unit
                                                                        ) =>
                                                                            `${unit.name} = ${formatNumber(unit.conversionRate)} ${medicine.baseUnitName.toLowerCase()}`
                                                                    )
                                                                    .join(
                                                                        ' · '
                                                                    )}
                                                            </p>
                                                        ) : null}
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
                                                                title="Sửa sản phẩm"
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
