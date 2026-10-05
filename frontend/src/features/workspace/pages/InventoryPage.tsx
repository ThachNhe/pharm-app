import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, History, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
} from '@/lib/utils';
import { workspaceService } from '../services/workspace.service';
import type { InventoryMedicine } from '../types';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    EmptyState,
    ErrorState,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    SearchInput,
    StatusBadge,
} from '../components/shared';

type AlertFilter = '' | 'low' | 'expiring';

const movementLabels = {
    import: 'Nhập kho',
    sale: 'Bán hàng',
    adjustment: 'Điều chỉnh',
    return_in: 'Trả vào',
    return_out: 'Trả ra',
};

export function InventoryPage({
    initialAlert = '',
}: {
    initialAlert?: AlertFilter;
}) {
    const [view, setView] = useState<'stock' | 'movements'>('stock');
    const [alert, setAlert] = useState<AlertFilter>(initialAlert);
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { selectedStoreId, hasRole } = useWorkspace();
    const canViewCosts = hasRole('manager');

    const inventoryQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'inventory',
            debouncedSearch,
            alert,
            page,
        ],
        queryFn: () =>
            workspaceService.getInventory(selectedStoreId, {
                search: debouncedSearch,
                alert,
                page,
                limit: 20,
            }),
        enabled: Boolean(selectedStoreId) && view === 'stock',
    });

    const movementsQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'inventory-movements', page],
        queryFn: () =>
            workspaceService.getInventoryMovements(selectedStoreId, {
                page,
                limit: 20,
            }),
        enabled:
            Boolean(selectedStoreId) && view === 'movements' && canViewCosts,
    });

    const renderBatchDetails = (medicine: InventoryMedicine) => (
        <div className="bg-muted/30 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {medicine.batches.length ? (
                medicine.batches.map((batch) => (
                    <div
                        key={batch.id}
                        className="border-border bg-card rounded-md border p-3 text-sm"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-medium">
                                    Lô {batch.batchNumber}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    HSD {formatDate(batch.expiryDate)}
                                </p>
                            </div>
                            <StatusBadge
                                tone={
                                    batch.isExpired
                                        ? 'danger'
                                        : new Date(batch.expiryDate).getTime() -
                                                new Date().setHours(
                                                    0,
                                                    0,
                                                    0,
                                                    0
                                                ) <=
                                            60 * 86400000
                                          ? 'danger'
                                          : 'success'
                                }
                            >
                                {batch.isExpired
                                    ? 'Hết hạn'
                                    : new Date(batch.expiryDate).getTime() -
                                            new Date().setHours(0, 0, 0, 0) <=
                                        60 * 86400000
                                      ? 'Cận hạn'
                                      : 'Còn hạn'}
                            </StatusBadge>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    Còn lại
                                </p>
                                <p className="font-semibold">
                                    {formatNumber(batch.quantityRemaining)}{' '}
                                    {medicine.baseUnitName.toLowerCase()}
                                </p>
                            </div>
                            {canViewCosts && batch.importPrice !== undefined ? (
                                <p className="text-muted-foreground text-xs">
                                    Vốn {formatCurrency(batch.importPrice)}
                                </p>
                            ) : null}
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-muted-foreground text-sm">
                    Chưa có lô tồn kho.
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            <PageHeader
                title="Tồn kho"
                description="Theo dõi tồn khả dụng, lô hàng và hạn sử dụng theo nguyên tắc FEFO."
                actions={
                    canViewCosts ? (
                        <div className="border-border bg-card flex rounded-md border p-1">
                            <Button
                                size="sm"
                                variant={
                                    view === 'stock' ? 'secondary' : 'ghost'
                                }
                                onClick={() => setView('stock')}
                            >
                                <PackageSearch />
                                Hiện tại
                            </Button>
                            <Button
                                size="sm"
                                variant={
                                    view === 'movements' ? 'secondary' : 'ghost'
                                }
                                onClick={() => setView('movements')}
                            >
                                <History />
                                Biến động
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            {view === 'stock' ? (
                <Panel className="overflow-hidden">
                    <div className="border-border flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Tìm tên, mã vạch, hoạt chất"
                        />
                        <div className="flex flex-wrap gap-2">
                            {[
                                ['', 'Tất cả'],
                                ['low', 'Tồn thấp'],
                                ['expiring', 'Cận hạn'],
                            ].map(([value, label]) => (
                                <Button
                                    key={value}
                                    size="sm"
                                    variant={
                                        alert === value ? 'secondary' : 'ghost'
                                    }
                                    onClick={() => {
                                        setAlert(value as AlertFilter);
                                        setPage(1);
                                    }}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {inventoryQuery.isPending ? (
                        <LoadingState />
                    ) : inventoryQuery.isError ? (
                        <ErrorState
                            onRetry={() => void inventoryQuery.refetch()}
                        />
                    ) : !inventoryQuery.data?.results.length ? (
                        <EmptyState
                            title="Không có mặt hàng phù hợp"
                            description={
                                alert
                                    ? 'Không có cảnh báo tồn kho trong nhóm đang chọn.'
                                    : 'Hoàn tất phiếu nhập để tạo lô và ghi nhận tồn kho.'
                            }
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[920px] text-left text-sm">
                                    <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">
                                                Mặt hàng
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Tồn khả dụng
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Hạn gần nhất
                                            </th>
                                            {canViewCosts ? (
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Giá trị tồn
                                                </th>
                                            ) : null}
                                            <th className="px-4 py-3 font-medium">
                                                Cảnh báo
                                            </th>
                                            <th className="w-16 px-4 py-3 text-right font-medium">
                                                Lô
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-border divide-y">
                                        {inventoryQuery.data.results.map(
                                            (medicine) => (
                                                <Fragment key={medicine.id}>
                                                    <tr className="hover:bg-muted/30">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">
                                                                {medicine.name}
                                                            </p>
                                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                                {medicine.barcode ||
                                                                    'Không có mã vạch'}{' '}
                                                                ·{' '}
                                                                {
                                                                    medicine
                                                                        .batches
                                                                        .length
                                                                }{' '}
                                                                lô còn tồn
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span
                                                                className={
                                                                    medicine.isLowStock
                                                                        ? 'text-muted-foreground font-semibold'
                                                                        : 'font-semibold'
                                                                }
                                                            >
                                                                {formatNumber(
                                                                    medicine.availableStock
                                                                )}
                                                            </span>{' '}
                                                            <span className="text-muted-foreground">
                                                                {medicine.baseUnitName.toLowerCase()}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className={
                                                                medicine.hasExpiringBatch
                                                                    ? 'text-destructive px-4 py-3 font-medium'
                                                                    : 'px-4 py-3'
                                                            }
                                                        >
                                                            {medicine.nearestExpiry
                                                                ? formatDate(
                                                                      medicine.nearestExpiry
                                                                  )
                                                                : '—'}
                                                        </td>
                                                        {canViewCosts ? (
                                                            <td className="px-4 py-3 text-right font-medium">
                                                                {formatCurrency(
                                                                    medicine.inventoryValue ??
                                                                        0
                                                                )}
                                                            </td>
                                                        ) : null}
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {medicine.isLowStock ? (
                                                                    <StatusBadge tone="neutral">
                                                                        Tồn thấp
                                                                    </StatusBadge>
                                                                ) : null}
                                                                {medicine.hasExpiringBatch ? (
                                                                    <StatusBadge tone="danger">
                                                                        Cận hạn
                                                                    </StatusBadge>
                                                                ) : null}
                                                                {!medicine.isLowStock &&
                                                                !medicine.hasExpiringBatch ? (
                                                                    <StatusBadge tone="success">
                                                                        Ổn định
                                                                    </StatusBadge>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setExpandedId(
                                                                        (
                                                                            current
                                                                        ) =>
                                                                            current ===
                                                                            medicine.id
                                                                                ? null
                                                                                : medicine.id
                                                                    )
                                                                }
                                                                aria-label={
                                                                    expandedId ===
                                                                    medicine.id
                                                                        ? `Thu gọn lô ${medicine.name}`
                                                                        : `Xem lô ${medicine.name}`
                                                                }
                                                                title="Xem các lô"
                                                            >
                                                                {expandedId ===
                                                                medicine.id ? (
                                                                    <ChevronUp />
                                                                ) : (
                                                                    <ChevronDown />
                                                                )}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                    {expandedId ===
                                                    medicine.id ? (
                                                        <tr>
                                                            <td
                                                                colSpan={
                                                                    canViewCosts
                                                                        ? 6
                                                                        : 5
                                                                }
                                                            >
                                                                {renderBatchDetails(
                                                                    medicine
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <Pager
                                page={inventoryQuery.data.page}
                                totalPages={inventoryQuery.data.totalPages}
                                totalResults={inventoryQuery.data.totalResults}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </Panel>
            ) : (
                <Panel className="overflow-hidden">
                    {movementsQuery.isPending ? (
                        <LoadingState label="Đang tải lịch sử biến động" />
                    ) : movementsQuery.isError ? (
                        <ErrorState
                            onRetry={() => void movementsQuery.refetch()}
                        />
                    ) : !movementsQuery.data?.results.length ? (
                        <EmptyState
                            title="Chưa có biến động kho"
                            description="Các lần nhập và bán hàng sẽ được ghi lại tại đây."
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[780px] text-left text-sm">
                                    <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">
                                                Thời gian
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Loại
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Sản phẩm / Lô
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Thay đổi
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Người thực hiện
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-border divide-y">
                                        {movementsQuery.data.results.map(
                                            (movement) => (
                                                <tr
                                                    key={movement.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="px-4 py-3">
                                                        {formatDateTime(
                                                            movement.createdAt
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge
                                                            tone={
                                                                movement.quantityDelta >
                                                                0
                                                                    ? 'success'
                                                                    : 'info'
                                                            }
                                                        >
                                                            {
                                                                movementLabels[
                                                                    movement
                                                                        .type
                                                                ]
                                                            }
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">
                                                            {
                                                                movement
                                                                    .medicine
                                                                    .name
                                                            }
                                                        </p>
                                                        <p className="text-muted-foreground text-xs">
                                                            {movement.stockBatch
                                                                ? `Lô ${movement.stockBatch.batchNumber}`
                                                                : 'Không gắn lô'}
                                                        </p>
                                                    </td>
                                                    <td
                                                        className={`px-4 py-3 text-right font-semibold ${
                                                            movement.quantityDelta >
                                                            0
                                                                ? 'text-emerald-700'
                                                                : 'text-sky-700'
                                                        }`}
                                                    >
                                                        {movement.quantityDelta >
                                                        0
                                                            ? '+'
                                                            : ''}
                                                        {formatNumber(
                                                            movement.quantityDelta
                                                        )}
                                                    </td>
                                                    <td className="text-muted-foreground px-4 py-3">
                                                        {movement.createdByUser
                                                            ?.name ??
                                                            'Hệ thống'}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <Pager
                                page={movementsQuery.data.page}
                                totalPages={movementsQuery.data.totalPages}
                                totalResults={movementsQuery.data.totalResults}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </Panel>
            )}
        </div>
    );
}
