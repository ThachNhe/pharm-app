import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Eye,
    LoaderCircle,
    Minus,
    Plus,
    Printer,
    ReceiptText,
    Search,
    ShoppingCart,
    Trash2,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import { getApiErrorMessage } from '../utils/api-error';
import { workspaceService } from '../services/workspace.service';
import type { Medicine, PaymentMethod, Sale } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    EmptyState,
    ErrorState,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    StatusBadge,
} from '../components/shared';

type CartItem = {
    medicine: Medicine;
    quantity: number;
    unitId: string;
};

const getBaseUnit = (medicine: Medicine) =>
    medicine.units.find((unit) => unit.isBaseUnit) ?? {
        id: '',
        name: medicine.baseUnitName,
        conversionRate: 1,
        isBaseUnit: true,
    };

const getCartUnit = (item: CartItem) =>
    item.medicine.units.find((unit) => unit.id === item.unitId) ??
    getBaseUnit(item.medicine);

const paymentLabels: Record<PaymentMethod, string> = {
    cash: 'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    card: 'Thẻ',
    e_wallet: 'Ví điện tử',
    other: 'Khác',
};

function SaleReceipt({
    sale,
    onClose,
}: {
    sale: Sale | null;
    onClose: () => void;
}) {
    const { selectedStore } = useWorkspace();
    if (!sale) return null;
    const receiptLines = [
        ...sale.details
            .reduce(
                (lines, detail) => {
                    const key = `${detail.medicineId}:${detail.unitName}`;
                    const current = lines.get(key);
                    if (current) {
                        current.quantity += detail.displayQuantity;
                        current.amount += detail.quantity * detail.salePrice;
                        if (detail.stockBatch?.batchNumber) {
                            current.batches.add(detail.stockBatch.batchNumber);
                        }
                    } else {
                        lines.set(key, {
                            key,
                            medicineName: detail.medicine.name,
                            unitName: detail.unitName,
                            quantity: detail.displayQuantity,
                            unitPrice: detail.displaySalePrice,
                            amount: detail.quantity * detail.salePrice,
                            batches: new Set(
                                detail.stockBatch?.batchNumber
                                    ? [detail.stockBatch.batchNumber]
                                    : []
                            ),
                        });
                    }
                    return lines;
                },
                new Map<
                    string,
                    {
                        key: string;
                        medicineName: string;
                        unitName: string;
                        quantity: number;
                        unitPrice: number;
                        amount: number;
                        batches: Set<string>;
                    }
                >()
            )
            .values(),
    ];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
                <div data-print-receipt className="bg-card">
                    <DialogHeader>
                        <div className="text-center">
                            <DialogTitle className="text-xl">
                                {selectedStore?.name ?? 'Nhà thuốc'}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {selectedStore?.address || 'Hóa đơn bán hàng'}
                                {selectedStore?.phone
                                    ? ` · ${selectedStore.phone}`
                                    : ''}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="border-border my-4 border-y border-dashed py-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Mã hóa đơn
                            </span>
                            <span className="font-mono font-medium">
                                #{sale.id.slice(0, 8).toUpperCase()}
                            </span>
                        </div>
                        <div className="mt-1 flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Thời gian
                            </span>
                            <span>{formatDateTime(sale.soldAt)}</span>
                        </div>
                        <div className="mt-1 flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Nhân viên
                            </span>
                            <span>{sale.soldByUser.name}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                            <thead className="border-border text-muted-foreground border-b text-left text-xs uppercase">
                                <tr>
                                    <th className="py-2 pr-3 font-medium">
                                        Mặt hàng
                                    </th>
                                    <th className="px-2 py-2 text-right font-medium">
                                        SL
                                    </th>
                                    <th className="px-2 py-2 text-right font-medium">
                                        Đơn giá
                                    </th>
                                    <th className="py-2 pl-3 text-right font-medium">
                                        Thành tiền
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border divide-y">
                                {receiptLines.map((line) => (
                                    <tr key={line.key}>
                                        <td className="py-2 pr-3">
                                            <p className="font-medium">
                                                {line.medicineName}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Lô{' '}
                                                {[...line.batches].join(', ') ||
                                                    '—'}
                                            </p>
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            {formatNumber(line.quantity)}{' '}
                                            {line.unitName.toLowerCase()}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                            {formatCurrency(line.unitPrice)}
                                        </td>
                                        <td className="py-2 pl-3 text-right font-medium">
                                            {formatCurrency(line.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-border mt-4 ml-auto w-full max-w-xs space-y-2 border-t pt-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Tiền hàng
                            </span>
                            <span>
                                {formatCurrency(
                                    sale.totalAmount + sale.discountAmount
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Giảm giá
                            </span>
                            <span>-{formatCurrency(sale.discountAmount)}</span>
                        </div>
                        <div className="border-border flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                            <span>Thanh toán</span>
                            <span className="text-primary">
                                {formatCurrency(sale.totalAmount)}
                            </span>
                        </div>
                        <div className="text-muted-foreground flex justify-between gap-4 text-xs">
                            <span>Phương thức</span>
                            <span>{paymentLabels[sale.paymentMethod]}</span>
                        </div>
                    </div>
                    <p className="text-muted-foreground mt-6 text-center text-xs">
                        Cảm ơn quý khách. Vui lòng kiểm tra hàng trước khi rời
                        quầy.
                    </p>
                </div>

                <DialogFooter className="print-hidden">
                    <Button variant="outline" onClick={onClose}>
                        Đóng
                    </Button>
                    <Button onClick={() => window.print()}>
                        <Printer />
                        In hóa đơn
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PointOfSale({ onCreated }: { onCreated: (sale: Sale) => void }) {
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [note, setNote] = useState('');
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();
    const debouncedSearch = useDebounce(search, 250);

    const medicinesQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'medicines',
            'sale-catalog',
            debouncedSearch,
        ],
        queryFn: () =>
            workspaceService.getMedicines(selectedStoreId, {
                page: 1,
                limit: 100,
                active: true,
                search: debouncedSearch,
            }),
        enabled: Boolean(selectedStoreId),
    });

    const availableMedicines = medicinesQuery.data?.results ?? [];

    const subtotal = cart.reduce(
        (sum, item) =>
            sum +
            item.medicine.sellingPrice *
                getCartUnit(item).conversionRate *
                item.quantity,
        0
    );
    const payable = Math.max(0, subtotal - discount);

    const updateQuantity = (medicineId: string, quantity: number) => {
        setCart((current) =>
            current
                .map((item) => {
                    if (item.medicine.id !== medicineId) return item;
                    const maxQuantity =
                        item.medicine.availableStock /
                        getCartUnit(item).conversionRate;
                    return {
                        ...item,
                        quantity: Math.min(Math.max(quantity, 0), maxQuantity),
                    };
                })
                .filter((item) => item.quantity > 0)
        );
    };

    const changeUnit = (medicineId: string, unitId: string) => {
        setCart((current) =>
            current.map((item) => {
                if (item.medicine.id !== medicineId) return item;
                const previousRate = getCartUnit(item).conversionRate;
                const nextUnit =
                    item.medicine.units.find((unit) => unit.id === unitId) ??
                    getBaseUnit(item.medicine);
                return {
                    ...item,
                    unitId: nextUnit.id ?? '',
                    quantity: Number(
                        (
                            (item.quantity * previousRate) /
                            nextUnit.conversionRate
                        ).toFixed(2)
                    ),
                };
            })
        );
    };

    const addMedicine = (medicine: Medicine) => {
        if (medicine.availableStock <= 0) {
            toast.error(`${medicine.name} đã hết tồn khả dụng`);
            return;
        }
        setCart((current) => {
            const existing = current.find(
                (item) => item.medicine.id === medicine.id
            );
            if (!existing) {
                const base = getBaseUnit(medicine);
                return [
                    ...current,
                    { medicine, quantity: 1, unitId: base.id ?? '' },
                ];
            }
            const unit = getCartUnit(existing);
            if (
                existing.quantity * unit.conversionRate >=
                medicine.availableStock
            ) {
                toast.warning(`Đã đạt số lượng tồn của ${medicine.name}`);
                return current;
            }
            return current.map((item) =>
                item.medicine.id === medicine.id
                    ? {
                          ...item,
                          quantity: Math.min(
                              item.quantity + 1,
                              item.medicine.availableStock /
                                  getCartUnit(item).conversionRate
                          ),
                      }
                    : item
            );
        });
    };

    const mutation = useMutation({
        mutationFn: () =>
            workspaceService.createSale(selectedStoreId, {
                paymentMethod,
                discountAmount: discount,
                note: note || undefined,
                items: cart.map((item) => ({
                    medicineId: item.medicine.id,
                    quantity: item.quantity,
                    unitId: item.unitId || undefined,
                })),
            }),
        onSuccess: (sale) => {
            toast.success('Đã hoàn tất đơn bán');
            setCart([]);
            setDiscount(0);
            setNote('');
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId],
            });
            onCreated(sale);
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(
                    error,
                    'Không thể hoàn tất đơn. Tồn kho có thể vừa thay đổi.'
                )
            ),
    });

    const submitSale = () => {
        if (!cart.length) {
            toast.error('Hãy thêm ít nhất một sản phẩm vào đơn');
            return;
        }
        if (discount < 0 || discount > subtotal) {
            toast.error('Giảm giá không được lớn hơn tiền hàng');
            return;
        }
        mutation.mutate();
    };

    return (
        <div className="grid min-h-[620px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel className="min-w-0 overflow-hidden">
                <div className="border-border border-b p-4">
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            autoFocus
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Quét mã vạch hoặc tìm tên sản phẩm"
                            className="h-11 pl-10"
                            aria-label="Tìm sản phẩm để bán"
                        />
                    </div>
                </div>

                {medicinesQuery.isPending ? (
                    <LoadingState label="Đang tải danh mục bán hàng" />
                ) : medicinesQuery.isError ? (
                    <ErrorState onRetry={() => void medicinesQuery.refetch()} />
                ) : !availableMedicines.length ? (
                    <EmptyState
                        title="Không tìm thấy sản phẩm"
                        description="Kiểm tra từ khóa hoặc bổ sung sản phẩm vào danh mục quầy."
                    />
                ) : (
                    <div className="divide-border max-h-[70vh] divide-y overflow-y-auto">
                        {availableMedicines.map((medicine) => {
                            const cartItem = cart.find(
                                (item) => item.medicine.id === medicine.id
                            );
                            return (
                                <button
                                    key={medicine.id}
                                    type="button"
                                    disabled={medicine.availableStock <= 0}
                                    onClick={() => addMedicine(medicine)}
                                    className="hover:bg-muted/45 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                    <div className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-md">
                                        <ReceiptText className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium">
                                                {medicine.name}
                                            </p>
                                            {medicine.requiresPrescription ? (
                                                <StatusBadge tone="warning">
                                                    Kê đơn
                                                </StatusBadge>
                                            ) : null}
                                        </div>
                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                            {medicine.barcode ||
                                                'Không có mã vạch'}{' '}
                                            · Còn{' '}
                                            {formatNumber(
                                                medicine.availableStock
                                            )}{' '}
                                            {medicine.baseUnitName.toLowerCase()}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="font-semibold">
                                            {formatCurrency(
                                                medicine.sellingPrice
                                            )}
                                        </p>
                                        {cartItem ? (
                                            <p className="text-primary text-xs font-medium">
                                                Trong giỏ:{' '}
                                                {formatNumber(
                                                    cartItem.quantity
                                                )}{' '}
                                                {getCartUnit(
                                                    cartItem
                                                ).name.toLowerCase()}
                                            </p>
                                        ) : (
                                            <p className="text-muted-foreground text-xs">
                                                /{' '}
                                                {medicine.baseUnitName.toLowerCase()}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </Panel>

            <Panel className="flex min-h-[560px] flex-col overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100vh-6.5rem)]">
                <div className="border-border flex items-center justify-between border-b px-4 py-4">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="text-primary size-4" />
                        <h2 className="font-semibold">Đơn bán hiện tại</h2>
                    </div>
                    <StatusBadge tone="info">
                        {cart.length} mặt hàng
                    </StatusBadge>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {!cart.length ? (
                        <EmptyState
                            title="Giỏ hàng đang trống"
                            description="Chọn sản phẩm ở danh sách để thêm vào đơn."
                        />
                    ) : (
                        <div className="divide-border divide-y">
                            {cart.map((item) => {
                                const unit = getCartUnit(item);
                                const maxQuantity =
                                    item.medicine.availableStock /
                                    unit.conversionRate;
                                return (
                                    <div key={item.medicine.id} className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {item.medicine.name}
                                                </p>
                                                <p className="text-muted-foreground mt-0.5 text-xs">
                                                    {formatCurrency(
                                                        item.medicine
                                                            .sellingPrice *
                                                            unit.conversionRate
                                                    )}{' '}
                                                    / {unit.name.toLowerCase()}
                                                </p>
                                            </div>
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    updateQuantity(
                                                        item.medicine.id,
                                                        0
                                                    )
                                                }
                                                aria-label={`Xóa ${item.medicine.name}`}
                                                title="Xóa khỏi giỏ"
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        </div>
                                        {item.medicine.units.length > 1 ? (
                                            <label className="mt-3 grid gap-1 text-xs font-medium">
                                                Đơn vị bán
                                                <select
                                                    value={unit.id ?? ''}
                                                    onChange={(event) =>
                                                        changeUnit(
                                                            item.medicine.id,
                                                            event.target.value
                                                        )
                                                    }
                                                    className="border-input bg-input-background focus:border-ring h-9 rounded-md border px-3 text-sm outline-none"
                                                    aria-label={`Đơn vị bán ${item.medicine.name}`}
                                                >
                                                    {item.medicine.units.map(
                                                        (option) => (
                                                            <option
                                                                key={option.id}
                                                                value={
                                                                    option.id
                                                                }
                                                            >
                                                                {option.name}
                                                                {option.isBaseUnit
                                                                    ? ''
                                                                    : ` (${formatNumber(option.conversionRate)} ${item.medicine.baseUnitName.toLowerCase()})`}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        ) : null}
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <div className="border-input flex items-center rounded-md border">
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.medicine.id,
                                                            item.quantity - 1
                                                        )
                                                    }
                                                    aria-label={`Giảm ${item.medicine.name}`}
                                                >
                                                    <Minus />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    min="0.01"
                                                    max={maxQuantity}
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={(event) =>
                                                        updateQuantity(
                                                            item.medicine.id,
                                                            Number(
                                                                event.target
                                                                    .value
                                                            )
                                                        )
                                                    }
                                                    className="h-8 w-20 rounded-none border-y-0 text-center shadow-none"
                                                    aria-label={`Số lượng ${item.medicine.name}`}
                                                />
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    disabled={
                                                        item.quantity >=
                                                        maxQuantity
                                                    }
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.medicine.id,
                                                            item.quantity + 1
                                                        )
                                                    }
                                                    aria-label={`Tăng ${item.medicine.name}`}
                                                >
                                                    <Plus />
                                                </Button>
                                            </div>
                                            <p className="font-semibold">
                                                {formatCurrency(
                                                    item.medicine.sellingPrice *
                                                        unit.conversionRate *
                                                        item.quantity
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="border-border bg-muted/20 space-y-3 border-t p-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1 text-xs font-medium">
                            Phương thức
                            <select
                                value={paymentMethod}
                                onChange={(event) =>
                                    setPaymentMethod(
                                        event.target.value as PaymentMethod
                                    )
                                }
                                className="border-input bg-input-background focus:border-ring h-9 rounded-md border px-2 text-sm outline-none"
                            >
                                {Object.entries(paymentLabels).map(
                                    ([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>
                        <label className="grid gap-1 text-xs font-medium">
                            Giảm giá
                            <Input
                                type="number"
                                min="0"
                                max={subtotal}
                                step="100"
                                value={discount}
                                onChange={(event) =>
                                    setDiscount(Number(event.target.value))
                                }
                                inputMode="decimal"
                            />
                        </label>
                    </div>
                    <label className="grid gap-1 text-xs font-medium">
                        Ghi chú
                        <Input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Thông tin khách hoặc đơn thuốc"
                        />
                    </label>
                    <div className="border-border space-y-1 border-t pt-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Tiền hàng
                            </span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                            <span className="font-semibold">
                                Khách thanh toán
                            </span>
                            <span className="text-primary text-2xl font-semibold">
                                {formatCurrency(payable)}
                            </span>
                        </div>
                    </div>
                    <Button
                        className="h-11 w-full"
                        disabled={!cart.length || mutation.isPending}
                        onClick={submitSale}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <ShoppingCart />
                        )}
                        Hoàn tất thanh toán
                    </Button>
                </div>
            </Panel>
        </div>
    );
}

function SalesHistory({ onOpenSale }: { onOpenSale: (sale: Sale) => void }) {
    const [page, setPage] = useState(1);
    const { selectedStoreId } = useWorkspace();

    const salesQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'sales', page],
        queryFn: () =>
            workspaceService.getSales(selectedStoreId, { page, limit: 20 }),
        enabled: Boolean(selectedStoreId),
    });

    return (
        <Panel className="overflow-hidden">
            {salesQuery.isPending ? (
                <LoadingState label="Đang tải lịch sử bán hàng" />
            ) : salesQuery.isError ? (
                <ErrorState onRetry={() => void salesQuery.refetch()} />
            ) : !salesQuery.data?.results.length ? (
                <EmptyState
                    title="Chưa có đơn bán"
                    description="Đơn hoàn tất sẽ xuất hiện tại đây."
                />
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-left text-sm">
                            <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Mã hóa đơn
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Thời gian
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Nhân viên
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Mặt hàng
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Thanh toán
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Tổng tiền
                                    </th>
                                    <th className="w-16 px-4 py-3 text-right font-medium">
                                        Xem
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border divide-y">
                                {salesQuery.data.results.map((sale) => (
                                    <tr
                                        key={sale.id}
                                        className="hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs font-medium">
                                            #{sale.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-4 py-3">
                                            {formatDateTime(sale.soldAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {sale.soldByUser.name}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatNumber(sale.details.length)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {paymentLabels[sale.paymentMethod]}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            {formatCurrency(sale.totalAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                onClick={() => onOpenSale(sale)}
                                                aria-label={`Xem hóa đơn ${sale.id}`}
                                                title="Xem hóa đơn"
                                            >
                                                <Eye />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager
                        page={salesQuery.data.page}
                        totalPages={salesQuery.data.totalPages}
                        totalResults={salesQuery.data.totalResults}
                        onPageChange={setPage}
                    />
                </>
            )}
        </Panel>
    );
}

export function SalesPage() {
    const { canSell } = useWorkspace();
    const [view, setView] = useState<'pos' | 'history'>('pos');
    const [receipt, setReceipt] = useState<Sale | null>(null);

    return (
        <div className="space-y-5">
            <PageHeader
                title="Bán hàng"
                description={
                    canSell
                        ? 'Tạo đơn và trừ tồn theo lô có hạn sử dụng gần nhất.'
                        : 'Tra cứu lịch sử và chi tiết đơn bán tại quầy.'
                }
                actions={
                    <div className="border-border bg-card flex rounded-md border p-1">
                        {canSell && (
                            <Button
                                size="sm"
                                variant={view === 'pos' ? 'secondary' : 'ghost'}
                                onClick={() => setView('pos')}
                            >
                                <ShoppingCart />
                                Tạo đơn
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant={
                                !canSell || view === 'history'
                                    ? 'secondary'
                                    : 'ghost'
                            }
                            onClick={() => setView('history')}
                        >
                            <ReceiptText />
                            Lịch sử
                        </Button>
                    </div>
                }
            />

            {canSell && view === 'pos' ? (
                <PointOfSale onCreated={setReceipt} />
            ) : (
                <SalesHistory onOpenSale={setReceipt} />
            )}

            <SaleReceipt sale={receipt} onClose={() => setReceipt(null)} />
        </div>
    );
}
