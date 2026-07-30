import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Boxes, ReceiptText, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    formatCurrency,
    formatDate,
    formatNumber,
    toDateInputValue,
} from '@/lib/utils';
import { useWorkspace } from '../useWorkspace';
import { workspaceService } from '../services/workspace.service';
import {
    EmptyState,
    ErrorState,
    LoadingState,
    PageHeader,
    Panel,
    PermissionDenied,
} from '../components/shared';

const now = new Date();
const initialTo = toDateInputValue(now);
const initialFrom = toDateInputValue(
    new Date(now.getFullYear(), now.getMonth(), 1)
);

export function ReportsPage() {
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState(initialTo);
    const { selectedStoreId, hasRole } = useWorkspace();

    const reportQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'profit-report', from, to],
        queryFn: () =>
            workspaceService.getProfitReport(selectedStoreId, { from, to }),
        enabled: Boolean(selectedStoreId) && hasRole('manager') && from <= to,
    });

    const maxRevenue = useMemo(
        () =>
            Math.max(
                1,
                ...(reportQuery.data?.series.map((item) => item.revenue) ?? [1])
            ),
        [reportQuery.data?.series]
    );

    if (!hasRole('manager')) return <PermissionDenied />;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Báo cáo kinh doanh"
                description="Doanh thu, giá vốn và lãi gộp được tính trực tiếp từ các đơn đã hoàn tất."
                actions={
                    <div className="border-border bg-card flex flex-wrap items-end gap-2 rounded-md border p-2">
                        <label className="grid gap-1 text-xs font-medium">
                            Từ ngày
                            <Input
                                type="date"
                                value={from}
                                max={to}
                                onChange={(event) =>
                                    setFrom(event.target.value)
                                }
                                className="w-36"
                            />
                        </label>
                        <label className="grid gap-1 text-xs font-medium">
                            Đến ngày
                            <Input
                                type="date"
                                value={to}
                                min={from}
                                max={initialTo}
                                onChange={(event) => setTo(event.target.value)}
                                className="w-36"
                            />
                        </label>
                    </div>
                }
            />

            {from > to ? (
                <Panel>
                    <ErrorState
                        title="Khoảng ngày không hợp lệ"
                        description="Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
                    />
                </Panel>
            ) : reportQuery.isPending ? (
                <LoadingState label="Đang tổng hợp số liệu kinh doanh" />
            ) : reportQuery.isError || !reportQuery.data ? (
                <Panel>
                    <ErrorState onRetry={() => void reportQuery.refetch()} />
                </Panel>
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            {
                                label: 'Doanh thu',
                                value: formatCurrency(
                                    reportQuery.data.totals.revenue
                                ),
                                icon: Banknote,
                                tone: 'bg-emerald-100 text-emerald-700',
                            },
                            {
                                label: 'Lãi gộp',
                                value: formatCurrency(
                                    reportQuery.data.totals.grossProfit
                                ),
                                icon: TrendingUp,
                                tone: 'bg-sky-100 text-sky-700',
                            },
                            {
                                label: 'Đơn hoàn tất',
                                value: formatNumber(
                                    reportQuery.data.totals.orders
                                ),
                                icon: ReceiptText,
                                tone: 'bg-brand-sky text-brand-navy',
                            },
                            {
                                label: 'Giá trị tồn',
                                value: formatCurrency(
                                    reportQuery.data.totals.inventoryValue
                                ),
                                icon: Boxes,
                                tone: 'bg-amber-100 text-amber-800',
                            },
                        ].map(({ label, value, icon: Icon, tone }) => (
                            <Panel key={label} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-sm">
                                            {label}
                                        </p>
                                        <p className="mt-2 truncate text-2xl font-semibold">
                                            {value}
                                        </p>
                                    </div>
                                    <div
                                        className={`grid size-9 shrink-0 place-items-center rounded-md ${tone}`}
                                    >
                                        <Icon className="size-4" />
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
                        <Panel className="overflow-hidden">
                            <div className="border-border border-b px-4 py-4 sm:px-5">
                                <h2 className="font-semibold">
                                    Doanh thu theo ngày
                                </h2>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Phần xanh đậm trong mỗi cột là lãi gộp.
                                </p>
                            </div>
                            {!reportQuery.data.series.length ? (
                                <EmptyState
                                    title="Chưa có doanh thu trong kỳ"
                                    description="Thử chọn khoảng thời gian khác hoặc hoàn tất đơn bán đầu tiên."
                                />
                            ) : (
                                <div className="overflow-x-auto p-4 sm:p-5">
                                    <div className="border-border flex h-72 min-w-[600px] items-end gap-2 border-b">
                                        {reportQuery.data.series.map((item) => {
                                            const revenueHeight = Math.max(
                                                4,
                                                (item.revenue / maxRevenue) *
                                                    240
                                            );
                                            const profitRatio =
                                                item.revenue > 0
                                                    ? Math.max(
                                                          0,
                                                          Math.min(
                                                              1,
                                                              item.grossProfit /
                                                                  item.revenue
                                                          )
                                                      )
                                                    : 0;
                                            return (
                                                <div
                                                    key={item.date}
                                                    className="flex min-w-9 flex-1 flex-col items-center justify-end"
                                                    title={`${formatDate(item.date)}: ${formatCurrency(item.revenue)}`}
                                                >
                                                    <span className="text-muted-foreground mb-1 text-[10px]">
                                                        {formatNumber(
                                                            item.orders
                                                        )}
                                                    </span>
                                                    <div
                                                        className="bg-brand-sky relative w-full max-w-12 overflow-hidden rounded-t-sm"
                                                        style={{
                                                            height: `${revenueHeight}px`,
                                                        }}
                                                    >
                                                        <div
                                                            className="bg-primary absolute inset-x-0 bottom-0"
                                                            style={{
                                                                height: `${Math.max(
                                                                    2,
                                                                    revenueHeight *
                                                                        profitRatio
                                                                )}px`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground mt-2 text-[10px]">
                                                        {new Date(
                                                            item.date
                                                        ).toLocaleDateString(
                                                            'vi-VN',
                                                            {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                            }
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Panel>

                        <Panel className="p-4 sm:p-5">
                            <h2 className="font-semibold">Hiệu quả trong kỳ</h2>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <div className="mb-1 flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Giá vốn
                                        </span>
                                        <span>
                                            {formatCurrency(
                                                reportQuery.data.totals.cost
                                            )}
                                        </span>
                                    </div>
                                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                                        <div
                                            className="bg-brand-navy h-full"
                                            style={{
                                                width: `${
                                                    reportQuery.data.totals
                                                        .revenue > 0
                                                        ? Math.min(
                                                              100,
                                                              (reportQuery.data
                                                                  .totals.cost /
                                                                  reportQuery
                                                                      .data
                                                                      .totals
                                                                      .revenue) *
                                                                  100
                                                          )
                                                        : 0
                                                }%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-1 flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Biên lãi gộp
                                        </span>
                                        <span className="text-primary font-semibold">
                                            {reportQuery.data.totals.revenue > 0
                                                ? `${(
                                                      (reportQuery.data.totals
                                                          .grossProfit /
                                                          reportQuery.data
                                                              .totals.revenue) *
                                                      100
                                                  ).toFixed(1)}%`
                                                : '0%'}
                                        </span>
                                    </div>
                                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                                        <div
                                            className="bg-primary h-full"
                                            style={{
                                                width: `${
                                                    reportQuery.data.totals
                                                        .revenue > 0
                                                        ? Math.max(
                                                              0,
                                                              Math.min(
                                                                  100,
                                                                  (reportQuery
                                                                      .data
                                                                      .totals
                                                                      .grossProfit /
                                                                      reportQuery
                                                                          .data
                                                                          .totals
                                                                          .revenue) *
                                                                      100
                                                              )
                                                          )
                                                        : 0
                                                }%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="border-border border-t pt-4">
                                    <p className="text-muted-foreground text-sm">
                                        Lãi gộp = doanh thu sau giảm giá − giá
                                        vốn theo lô đã bán.
                                    </p>
                                </div>
                            </div>
                        </Panel>
                    </div>

                    <Panel className="overflow-hidden">
                        <div className="border-border border-b px-4 py-4 sm:px-5">
                            <h2 className="font-semibold">
                                Thuốc đóng góp lãi cao
                            </h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Xếp theo lãi gộp trong khoảng thời gian đã chọn.
                            </p>
                        </div>
                        {!reportQuery.data.topMedicines.length ? (
                            <EmptyState title="Chưa có dữ liệu mặt hàng" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">
                                                Mặt hàng
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Đã bán
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Doanh thu
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Giá vốn
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Lãi gộp
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-border divide-y">
                                        {reportQuery.data.topMedicines.map(
                                            (medicine, index) => (
                                                <tr
                                                    key={medicine.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="px-4 py-3">
                                                        <span className="bg-muted mr-3 inline-grid size-6 place-items-center rounded-full text-xs font-medium">
                                                            {index + 1}
                                                        </span>
                                                        <span className="font-medium">
                                                            {medicine.name}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(
                                                            medicine.quantity
                                                        )}{' '}
                                                        {medicine.unit.toLowerCase()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {formatCurrency(
                                                            medicine.revenue
                                                        )}
                                                    </td>
                                                    <td className="text-muted-foreground px-4 py-3 text-right">
                                                        {formatCurrency(
                                                            medicine.cost
                                                        )}
                                                    </td>
                                                    <td className="text-primary px-4 py-3 text-right font-semibold">
                                                        {formatCurrency(
                                                            medicine.grossProfit
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </>
            )}
        </div>
    );
}
