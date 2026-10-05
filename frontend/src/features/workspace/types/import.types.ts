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
        baseQuantity: number;
        baseImportPrice: number;
        unitName: string;
        conversionRate: number;
        expiryDate: string;
        /** Selling price per base unit applied when the receipt is completed. */
        newSellingPrice?: number | null;
        /** Current selling price per base unit; only on the single-receipt endpoint. */
        currentSellingPrice?: number | null;
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
        unitId?: string;
        /** New selling price per base unit, applied when the receipt is completed. */
        sellingPrice?: number;
    }>;
}
