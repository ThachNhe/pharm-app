export interface ProductCategory {
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    productCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ProductCategoryPayload {
    name: string;
    description?: string;
    isActive?: boolean;
}
