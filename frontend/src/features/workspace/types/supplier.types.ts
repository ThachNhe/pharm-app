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

export interface SupplierPayload {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    isActive?: boolean;
}
