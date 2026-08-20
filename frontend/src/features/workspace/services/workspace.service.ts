import { apiGet, apiPatch, apiPost } from '@/services/api';
import { API_ENDPOINTS } from '@/services/endpoints';
import type {
    ImportPayload,
    ImportReceipt,
    InventoryMedicine,
    InventoryMovement,
    Medicine,
    MedicinePayload,
    Paginated,
    ProfitReport,
    ProductCategory,
    ProductCategoryPayload,
    ReferenceProduct,
    Sale,
    SalePayload,
    StoreDashboard,
    Supplier,
    SupplierPayload,
    WorkspaceContext,
} from '../types';

const cleanParams = (params: Record<string, unknown> = {}) =>
    Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) => value !== '' && value != null
        )
    );

export const workspaceService = {
    getContext: () =>
        apiGet<WorkspaceContext>(API_ENDPOINTS.OPERATIONS.CONTEXT),
    getDashboard: (storeId: string) =>
        apiGet<StoreDashboard>(API_ENDPOINTS.OPERATIONS.DASHBOARD(storeId)),

    getSuppliers: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<Supplier>>(
            API_ENDPOINTS.OPERATIONS.SUPPLIERS(storeId),
            cleanParams(params)
        ),
    createSupplier: (storeId: string, payload: SupplierPayload) =>
        apiPost<Supplier>(API_ENDPOINTS.OPERATIONS.SUPPLIERS(storeId), payload),
    updateSupplier: (
        storeId: string,
        supplierId: string,
        payload: Partial<SupplierPayload>
    ) =>
        apiPatch<Supplier>(
            API_ENDPOINTS.OPERATIONS.SUPPLIER(storeId, supplierId),
            payload
        ),

    getProductCategories: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<ProductCategory>>(
            API_ENDPOINTS.OPERATIONS.PRODUCT_CATEGORIES(storeId),
            cleanParams(params)
        ),
    createProductCategory: (storeId: string, payload: ProductCategoryPayload) =>
        apiPost<ProductCategory>(
            API_ENDPOINTS.OPERATIONS.PRODUCT_CATEGORIES(storeId),
            payload
        ),
    updateProductCategory: (
        storeId: string,
        categoryId: string,
        payload: Partial<ProductCategoryPayload>
    ) =>
        apiPatch<ProductCategory>(
            API_ENDPOINTS.OPERATIONS.PRODUCT_CATEGORY(storeId, categoryId),
            payload
        ),

    getMedicines: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<InventoryMedicine>>(
            API_ENDPOINTS.OPERATIONS.MEDICINES(storeId),
            cleanParams(params)
        ),
    createMedicine: (storeId: string, payload: MedicinePayload) =>
        apiPost<Medicine>(API_ENDPOINTS.OPERATIONS.MEDICINES(storeId), payload),
    updateMedicine: (
        storeId: string,
        medicineId: string,
        payload: Partial<MedicinePayload> & { isActive?: boolean }
    ) =>
        apiPatch<Medicine>(
            API_ENDPOINTS.OPERATIONS.MEDICINE(storeId, medicineId),
            payload
        ),
    getReferenceProducts: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<ReferenceProduct>>(
            API_ENDPOINTS.OPERATIONS.REFERENCE_PRODUCTS(storeId),
            cleanParams(params)
        ),

    getImports: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<ImportReceipt>>(
            API_ENDPOINTS.OPERATIONS.IMPORTS(storeId),
            cleanParams(params)
        ),
    getImport: (storeId: string, receiptId: string) =>
        apiGet<ImportReceipt>(
            API_ENDPOINTS.OPERATIONS.IMPORT(storeId, receiptId)
        ),
    createImport: (storeId: string, payload: ImportPayload) =>
        apiPost<ImportReceipt>(
            API_ENDPOINTS.OPERATIONS.IMPORTS(storeId),
            payload
        ),
    completeImport: (storeId: string, receiptId: string) =>
        apiPost<ImportReceipt>(
            API_ENDPOINTS.OPERATIONS.COMPLETE_IMPORT(storeId, receiptId)
        ),
    cancelImport: (storeId: string, receiptId: string) =>
        apiPost<{ message: string }>(
            API_ENDPOINTS.OPERATIONS.CANCEL_IMPORT(storeId, receiptId)
        ),

    getInventory: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<InventoryMedicine>>(
            API_ENDPOINTS.OPERATIONS.INVENTORY(storeId),
            cleanParams(params)
        ),
    getInventoryMovements: (
        storeId: string,
        params?: Record<string, unknown>
    ) =>
        apiGet<Paginated<InventoryMovement>>(
            API_ENDPOINTS.OPERATIONS.INVENTORY_MOVEMENTS(storeId),
            cleanParams(params)
        ),

    getSales: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<Paginated<Sale>>(
            API_ENDPOINTS.OPERATIONS.SALES(storeId),
            cleanParams(params)
        ),
    getSale: (storeId: string, saleId: string) =>
        apiGet<Sale>(API_ENDPOINTS.OPERATIONS.SALE(storeId, saleId)),
    createSale: (storeId: string, payload: SalePayload) =>
        apiPost<Sale>(API_ENDPOINTS.OPERATIONS.SALES(storeId), payload),

    getProfitReport: (storeId: string, params?: Record<string, unknown>) =>
        apiGet<ProfitReport>(
            API_ENDPOINTS.OPERATIONS.PROFIT_REPORT(storeId),
            cleanParams(params)
        ),
};
