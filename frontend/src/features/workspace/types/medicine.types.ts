export interface Medicine {
    id: string;
    storeMedicineId: string;
    referenceProductId?: string | null;
    categoryId: string;
    code: string;
    positionName?: string | null;
    name: string;
    baseUnitName: string;
    barcode?: string | null;
    secondaryBarcode?: string | null;
    registrationNumber?: string | null;
    category?: string | null;
    activeIngredient?: string | null;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    countryOfOrigin?: string | null;
    importerName?: string | null;
    specification?: string | null;
    usageInstructions?: string | null;
    requiresPrescription: boolean;
    description?: string | null;
    isActive: boolean;
    sellingPrice: number;
    minStock: number;
    totalStock: number;
    availableStock: number;
}

export interface ReferenceProduct {
    id: string;
    code?: string | null;
    name: string;
    unitName?: string | null;
    registrationNumber?: string | null;
    barcode?: string | null;
    secondaryBarcode?: string | null;
    manufacturer?: string | null;
    countryOfOrigin?: string | null;
    importerName?: string | null;
    activeIngredient?: string | null;
    specification?: string | null;
    usageInstructions?: string | null;
    categoryName?: string | null;
    positionName?: string | null;
    supplierName?: string | null;
    inputPrice?: number | null;
    referencePrice?: number | null;
    wholesalePrice?: number | null;
    doctorDiscountPercent?: number | null;
    employeeDiscountPercent?: number | null;
    minInventory?: number | null;
    isInternal: boolean;
    isNational: boolean;
    syncedAt: string;
    isAddedToStore: boolean;
}

export interface MedicinePayload {
    referenceProductId?: string;
    categoryId: string;
    code: string;
    positionName?: string;
    name: string;
    baseUnitName: string;
    barcode?: string;
    secondaryBarcode?: string;
    registrationNumber?: string;
    category?: string;
    activeIngredient?: string;
    strength?: string;
    dosageForm?: string;
    manufacturer?: string;
    countryOfOrigin?: string;
    importerName?: string;
    specification?: string;
    usageInstructions?: string;
    requiresPrescription?: boolean;
    description?: string;
    sellingPrice: number;
    minStock?: number;
    isActive?: boolean;
}
