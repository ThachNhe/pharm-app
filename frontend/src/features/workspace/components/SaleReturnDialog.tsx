import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { NumberInput } from '@/components/ui/number-input';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getApiErrorMessage } from '../utils/api-error';
import { workspaceService } from '../services/workspace.service';
import type { Sale } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import { Field } from './shared';

type SaleDetail = Sale['details'][number];

// Whole sale units only; the server converts to base units and validates the cap.
const getReturnableQuantity = (detail: SaleDetail) =>
    Math.floor(
        (detail.quantity - detail.returnedQuantity) / detail.conversionRate
    );

export function SaleReturnDialog({
    sale,
    onClose,
    onReturned,
}: {
    sale: Sale;
    onClose: () => void;
    onReturned: (sale: Sale) => void;
}) {
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();
    const [quantities, setQuantities] = useState<Record<string, number | null>>(
        {}
    );
    const [note, setNote] = useState('');

    // The discount is shared across lines pro rata; the server computes the exact refund.
    const grossAmount = sale.totalAmount + sale.discountAmount;
    const refundRatio = grossAmount > 0 ? sale.totalAmount / grossAmount : 0;
    const items = sale.details.flatMap((detail) => {
        const quantity = quantities[detail.id] ?? 0;
        return quantity > 0 ? [{ detail, quantity }] : [];
    });
    const estimatedRefund = items.reduce(
        (sum, { detail, quantity }) =>
            sum + Math.round(detail.displaySalePrice * quantity * refundRatio),
        0
    );

    const mutation = useMutation({
        mutationFn: () =>
            workspaceService.createSaleReturn(selectedStoreId, sale.id, {
                note: note.trim() || undefined,
                items: items.map(({ detail, quantity }) => ({
                    saleDetailId: detail.id,
                    quantity,
                })),
            }),
        onSuccess: (updatedSale) => {
            toast.success('Đã ghi nhận trả hàng và hoàn tiền');
            for (const key of [
                'sales',
                'medicines',
                'inventory',
                'dashboard',
                'profit-report',
            ]) {
                void queryClient.invalidateQueries({
                    queryKey: ['workspace', selectedStoreId, key],
                });
            }
            onReturned(updatedSale);
            onClose();
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể trả hàng.')),
    });

    return (
        <Dialog
            open
            onOpenChange={(open) => !open && !mutation.isPending && onClose()}
        >
            <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Trả hàng · #{sale.id.slice(0, 8).toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                        Nhập số lượng khách trả cho từng lô. Hàng được cộng lại
                        đúng lô đã bán và tiền hoàn tính theo giá bán sau giảm
                        giá.
                    </DialogDescription>
                </DialogHeader>

                <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
                    {sale.details.map((detail) => {
                        const returnable = getReturnableQuantity(detail);
                        const unitName = detail.unitName.toLowerCase();
                        return (
                            <div
                                key={detail.id}
                                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {detail.medicine.name}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Lô{' '}
                                        {detail.stockBatch?.batchNumber ?? '—'}{' '}
                                        · Đã bán{' '}
                                        {formatNumber(detail.displayQuantity)}{' '}
                                        {unitName}
                                        {detail.returnedQuantity > 0
                                            ? ` · đã trả ${formatNumber(detail.displayReturnedQuantity)}`
                                            : ''}
                                    </p>
                                </div>
                                {returnable > 0 ? (
                                    <Field
                                        label={`Trả (tối đa ${formatNumber(returnable)})`}
                                    >
                                        <NumberInput
                                            value={
                                                quantities[detail.id] ?? null
                                            }
                                            onValueChange={(value) =>
                                                setQuantities((current) => ({
                                                    ...current,
                                                    [detail.id]:
                                                        value === null
                                                            ? null
                                                            : Math.min(
                                                                  value,
                                                                  returnable
                                                              ),
                                                }))
                                            }
                                            suffix={unitName}
                                            placeholder="0"
                                            disabled={mutation.isPending}
                                            aria-label={`Số lượng trả ${detail.medicine.name} lô ${detail.stockBatch?.batchNumber ?? ''}`}
                                        />
                                    </Field>
                                ) : (
                                    <p className="text-muted-foreground text-sm sm:text-right">
                                        Đã trả hết
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <Field label="Lý do / ghi chú">
                    <textarea
                        rows={2}
                        maxLength={2000}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={mutation.isPending}
                        className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                        placeholder="Khách đổi ý, hàng lỗi..."
                    />
                </Field>

                <div className="border-primary/20 bg-secondary flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div>
                        <p className="text-muted-foreground text-sm">
                            Hoàn tiền dự kiến
                        </p>
                        <p className="text-muted-foreground text-xs">
                            {items.length} dòng hàng · số tiền chính xác do hệ
                            thống tính
                        </p>
                    </div>
                    <p className="text-brand-navy text-2xl font-semibold">
                        {formatCurrency(estimatedRefund)}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={onClose}
                    >
                        Hủy
                    </Button>
                    <Button
                        disabled={!items.length || mutation.isPending}
                        onClick={() => mutation.mutate()}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Undo2 />
                        )}
                        Xác nhận trả hàng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
