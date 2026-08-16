import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    Boxes,
    PackageCheck,
    PackagePlus,
    ShoppingCart,
    TrendingUp,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { workspaceService } from '../services/workspace.service';
import {
    ErrorState,
    LoadingState,
    PageHeader,
    Panel,
    StatusBadge,
} from '../components/shared';

export function DashboardPage() {
    const { selectedStoreId, selectedStore, hasRole } = useWorkspace();
    const dashboardQuery = useQuery({
        queryKey: ['workspace', selectedStoreId, 'dashboard'],
        queryFn: () => workspaceService.getDashboard(selectedStoreId),
        enabled: Boolean(selectedStoreId),
    });

    if (dashboardQuery.isPending) {
        return <LoadingState label="Đang tổng hợp hoạt động hôm nay" />;
    }

    if (dashboardQuery.isError || !dashboardQuery.data) {
        return (
            <Panel>
                <ErrorState onRetry={() => void dashboardQuery.refetch()} />
            </Panel>
        );
    }

    const data = dashboardQuery.data;
    const canViewFinancials = hasRole('manager');
    const metrics = [
        {
            label: 'Doanh thu hôm nay',
            value: formatCurrency(data.today.revenue),
            detail: `${formatNumber(data.today.orders)} đơn đã hoàn tất`,
            icon: Banknote,
            tone: 'text-emerald-700 bg-emerald-100',
        },
        ...(canViewFinancials
            ? [
                  {
                      label: 'Lãi gộp hôm nay',
                      value: formatCurrency(data.today.grossProfit ?? 0),
                      detail: `Giá vốn ${formatCurrency(data.today.cost ?? 0)}`,
                      icon: TrendingUp,
                      tone: 'text-sky-700 bg-sky-100',
                  },
              ]
            : []),
        {
            label: 'Mặt hàng đang quản lý',
            value: formatNumber(data.inventory.medicineCount),
            detail: `${formatNumber(data.inventory.lowStockCount)} mặt hàng sắp hết`,
            icon: Boxes,
            tone: 'text-brand-navy bg-brand-sky',
        },
        {
            label: 'Lô sắp hết hạn',
            value: formatNumber(data.inventory.expiringCount),
            detail: 'Trong vòng 60 ngày tới',
            icon: AlertTriangle,
            tone: 'text-amber-800 bg-amber-100',
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Tổng quan ${selectedStore?.name ?? ''}`}
                description="Tình hình bán hàng và tồn kho cập nhật theo quầy đang làm việc."
                actions={
                    <StatusBadge tone="success">Dữ liệu hôm nay</StatusBadge>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
                    <Panel key={label} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-muted-foreground text-sm">
                                    {label}
                                </p>
                                <p className="mt-2 truncate text-2xl font-semibold">
                                    {value}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {detail}
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Panel className="overflow-hidden">
                    <div className="border-border border-b px-4 py-4 sm:px-5">
                        <h2 className="font-semibold">Cảnh báo cần xử lý</h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Ưu tiên các mặt hàng có nguy cơ gián đoạn bán hàng.
                        </p>
                    </div>
                    <div className="divide-border divide-y">
                        <Link
                            to="/admin/inventory"
                            search={{ alert: 'low' }}
                            className="hover:bg-muted/45 flex items-center gap-3 px-4 py-4 transition-colors sm:px-5"
                        >
                            <div className="grid size-9 place-items-center rounded-md bg-rose-100 text-rose-700">
                                <PackageCheck className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">Tồn kho thấp</p>
                                <p className="text-muted-foreground text-sm">
                                    {formatNumber(data.inventory.lowStockCount)}{' '}
                                    mặt hàng bằng hoặc dưới định mức
                                </p>
                            </div>
                            <ArrowRight className="text-muted-foreground size-4" />
                        </Link>
                        <Link
                            to="/admin/inventory"
                            search={{ alert: 'expiring' }}
                            className="hover:bg-muted/45 flex items-center gap-3 px-4 py-4 transition-colors sm:px-5"
                        >
                            <div className="grid size-9 place-items-center rounded-md bg-amber-100 text-amber-800">
                                <AlertTriangle className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">Cận hạn sử dụng</p>
                                <p className="text-muted-foreground text-sm">
                                    {formatNumber(data.inventory.expiringCount)}{' '}
                                    mặt hàng có lô hết hạn trong 60 ngày
                                </p>
                            </div>
                            <ArrowRight className="text-muted-foreground size-4" />
                        </Link>
                    </div>
                </Panel>

                <Panel className="p-4 sm:p-5">
                    <h2 className="font-semibold">Thao tác nhanh</h2>
                    <div className="mt-4 grid gap-2">
                        <Link
                            to="/admin/sales"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors"
                        >
                            <ShoppingCart className="size-4" />
                            Tạo đơn bán
                            <ArrowRight className="ml-auto size-4" />
                        </Link>
                        {hasRole('manager') ? (
                            <Link
                                to="/admin/imports"
                                className="border-border hover:bg-muted flex h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors"
                            >
                                <PackagePlus className="size-4" />
                                Lập phiếu nhập
                                <ArrowRight className="ml-auto size-4" />
                            </Link>
                        ) : null}
                        <Link
                            to="/admin/inventory"
                            className="border-border hover:bg-muted flex h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors"
                        >
                            <Boxes className="size-4" />
                            Kiểm tra tồn kho
                            <ArrowRight className="ml-auto size-4" />
                        </Link>
                    </div>
                    {canViewFinancials ? (
                        <div className="border-border mt-5 border-t pt-4">
                            <p className="text-muted-foreground text-xs font-medium uppercase">
                                Giá trị tồn hiện tại
                            </p>
                            <p className="mt-1 text-lg font-semibold">
                                {formatCurrency(data.inventory.value ?? 0)}
                            </p>
                        </div>
                    ) : null}
                </Panel>
            </div>
        </div>
    );
}
