import type { Paginated } from './common.types';
import type { Medicine } from './medicine.types';

export interface InventoryMedicine extends Medicine {
    inventoryValue?: number;
    averageImportPrice?: number | null;
    saleValue: number;
    nearestExpiry?: string | null;
    isLowStock: boolean;
    hasExpiringBatch: boolean;
    batches: Array<{
        id: string;
        expiryDate: string;
        importPrice?: number;
        quantityRemaining: number;
        isExpired: boolean;
    }>;
}

export interface InventoryList extends Paginated<InventoryMedicine> {
    summary: {
        totalStock: number;
        saleValue: number;
        inventoryValue?: number;
    };
}

export interface InventoryMovement {
    id: string;
    type:
        | 'import'
        | 'sale'
        | 'return'
        | 'adjustment'
        | 'damage'
        | 'expired'
        | 'transfer_in'
        | 'transfer_out';
    quantityDelta: number;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
    createdAt: string;
    medicine: { id: string; name: string; baseUnitName: string };
    stockBatch?: {
        id: string;
        expiryDate: string;
    } | null;
    createdByUser?: { id: string; name: string } | null;
}
