export type StoreRole = 'owner' | 'manager' | 'staff';
export type PaymentMethod =
    | 'cash'
    | 'bank_transfer'
    | 'card'
    | 'e_wallet'
    | 'other';
export type ReceiptStatus = 'draft' | 'completed' | 'cancelled';

export interface WorkspaceStore {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    isActive: boolean;
    role: StoreRole | null;
}

export interface WorkspaceContext {
    user: {
        id: string;
        name: string;
        email: string;
        isSystemAdmin: boolean;
    };
    stores: WorkspaceStore[];
}

export interface Paginated<T> {
    results: T[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
}

export interface StoreDashboard {
    store: WorkspaceStore;
    role: StoreRole | null;
    today: {
        revenue: number;
        cost?: number;
        grossProfit?: number;
        orders: number;
    };
    inventory: {
        medicineCount: number;
        lowStockCount: number;
        expiringCount: number;
        value?: number;
    };
    supplierCount: number;
}

export interface Supplier {
    id: string;
    storeId: string;
    code?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxCode?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Medicine {
    id: string;
    storeMedicineId: string;
    name: string;
    baseUnitName: string;
    barcode?: string | null;
    registrationNumber?: string | null;
    category?: string | null;
    activeIngredient?: string | null;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    requiresPrescription: boolean;
    description?: string | null;
    isActive: boolean;
    sellingPrice: number;
    minStock: number;
    totalStock: number;
    availableStock: number;
}

export interface InventoryMedicine extends Medicine {
    inventoryValue?: number;
    nearestExpiry?: string | null;
    isLowStock: boolean;
    hasExpiringBatch: boolean;
    batches: Array<{
        id: string;
        batchNumber: string;
        expiryDate: string;
        importPrice?: number;
        quantityRemaining: number;
        isExpired: boolean;
    }>;
}

export interface ImportReceipt {
    id: string;
    storeId: string;
    supplierId?: string | null;
    supplierNameSnapshot?: string | null;
    status: ReceiptStatus;
    totalAmount: number;
    note?: string | null;
    importedAt: string;
    createdAt: string;
    supplier?: { id: string; name: string } | null;
    createdByUser: { id: string; name: string };
    details: Array<{
        id: string;
        medicineId: string;
        batchNumber: string;
        quantity: number;
        importPrice: number;
        expiryDate: string;
        medicine: { id: string; name: string; baseUnitName: string };
    }>;
}

export interface InventoryMovement {
    id: string;
    type: 'import' | 'sale' | 'adjustment' | 'return_in' | 'return_out';
    quantityDelta: number;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
    createdAt: string;
    medicine: { id: string; name: string; baseUnitName: string };
    stockBatch?: {
        id: string;
        batchNumber: string;
        expiryDate: string;
    } | null;
    createdByUser?: { id: string; name: string } | null;
}

export interface Sale {
    id: string;
    storeId: string;
    status: 'completed' | 'cancelled' | 'refunded';
    paymentMethod: PaymentMethod;
    discountAmount: number;
    totalAmount: number;
    soldAt: string;
    note?: string | null;
    soldByUser: { id: string; name: string };
    details: Array<{
        id: string;
        medicineId: string;
        quantity: number;
        salePrice: number;
        costPrice?: number;
        medicine: { id: string; name: string; baseUnitName: string };
        stockBatch?: {
            id: string;
            batchNumber: string;
            expiryDate: string;
        } | null;
    }>;
}

export interface ProfitReport {
    totals: {
        revenue: number;
        cost: number;
        grossProfit: number;
        orders: number;
        inventoryValue: number;
    };
    series: Array<{
        date: string;
        revenue: number;
        cost: number;
        grossProfit: number;
        orders: number;
    }>;
    topMedicines: Array<{
        id: string;
        name: string;
        unit: string;
        quantity: number;
        revenue: number;
        cost: number;
        grossProfit: number;
    }>;
}

export interface MedicinePayload {
    name: string;
    baseUnitName: string;
    barcode?: string;
    registrationNumber?: string;
    category?: string;
    activeIngredient?: string;
    strength?: string;
    dosageForm?: string;
    manufacturer?: string;
    requiresPrescription?: boolean;
    description?: string;
    sellingPrice: number;
    minStock?: number;
}

export interface SupplierPayload {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    isActive?: boolean;
}

export interface ImportPayload {
    supplierId?: string | null;
    importedAt?: string;
    note?: string;
    items: Array<{
        medicineId: string;
        batchNumber: string;
        quantity: number;
        importPrice: number;
        expiryDate: string;
    }>;
}

export interface SalePayload {
    paymentMethod: PaymentMethod;
    discountAmount?: number;
    note?: string;
    items: Array<{
        medicineId: string;
        quantity: number;
    }>;
}
