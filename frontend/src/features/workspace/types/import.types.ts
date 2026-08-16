export type ReceiptStatus = 'draft' | 'completed' | 'cancelled';

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
