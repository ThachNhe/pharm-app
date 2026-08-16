export type StoreRole = 'owner' | 'manager' | 'staff';

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
