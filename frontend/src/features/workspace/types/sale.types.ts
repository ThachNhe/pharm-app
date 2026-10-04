export type PaymentMethod =
    | 'cash'
    | 'bank_transfer'
    | 'card'
    | 'e_wallet'
    | 'other';

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
        displayQuantity: number;
        displaySalePrice: number;
        unitName: string;
        conversionRate: number;
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

export interface SalePayload {
    paymentMethod: PaymentMethod;
    discountAmount?: number;
    note?: string;
    items: Array<{
        medicineId: string;
        quantity: number;
        unitId?: string;
        /** Unit price shown to the customer; the server rejects the sale if it no longer matches. */
        expectedUnitPrice?: number;
    }>;
}
