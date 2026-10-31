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
import { PharmacyHeroIllustration } from '@/components/illustrations';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { workspaceService } from '../services/workspace.service';
import { ErrorState, LoadingState, Panel } from '../components/shared';

export function DashboardPage() {
    const {
        contextQuery,
        selectedStoreId,
        selectedStore,
        hasRole,
        canSell,
        canImport,
    } = useWorkspace();
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
            tone: 'bg-brand-mint',
        },
        ...(canViewFinancials
            ? [
                  {
                      label: 'Lãi gộp hôm nay',
                      value: formatCurrency(data.today.grossProfit ?? 0),
                      detail: `Giá vốn ${formatCurrency(data.today.cost ?? 0)}`,
                      icon: TrendingUp,
                      tone: 'bg-brand-pistachio',
                  },
              ]
            : []),
        {
            label: 'Mặt hàng đang quản lý',
            value: formatNumber(data.inventory.medicineCount),
            detail: `${formatNumber(data.inventory.lowStockCount)} mặt hàng sắp hết`,
            icon: Boxes,
            tone: 'bg-brand-butter',
        },
        {
            label: 'Lô sắp hết hạn',
            value: formatNumber(data.inventory.expiringCount),
            detail: 'Trong vòng 60 ngày tới',
            icon: AlertTriangle,
            tone: 'bg-brand-lavender',
        },
    ];

    return (
        <div className="space-y-6">
            <section className="bg-brand-forest relative overflow-hidden rounded-3xl text-white">
                <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:p-10">
                    <div className="min-w-0">
                        <p className="text-brand-lime text-xs font-bold tracking-wide uppercase">
                            Dữ liệu hôm nay
                        </p>
                        <h1 className="mt-2 text-2xl leading-tight font-extrabold sm:text-3xl">
                            Xin chào, {contextQuery.data?.user.name}
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                            Tình hình bán hàng và tồn kho của{' '}
                            <span className="font-bold text-white">
                                {selectedStore?.name}
                            </span>{' '}
                            cập nhật theo quầy đang làm việc.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {canSell ? (
                                <Link
                                    to="/admin/sales"
                                    className="bg-brand-lime text-brand-forest inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <ShoppingCart className="size-4" />
                                    Tạo đơn bán
                                </Link>
                            ) : null}
                            <Link
                                to="/admin/inventory"
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-bold text-white transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
                            >
                                <Boxes className="size-4" />
                                Kiểm tra tồn kho
                            </Link>
                        </div>
                    </div>
                    <PharmacyHeroIllustration className="hidden max-w-[300px] justify-self-end md:block" />
                </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
                    <div
                        key={label}
                        className={`text-brand-forest rounded-2xl p-5 ${tone}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/85 shadow-sm">
                                <Icon className="size-[1.125rem]" />
                            </div>
                            <p className="min-w-0 text-sm leading-5 font-bold">
                                {label}
                            </p>
                        </div>
                        <p className="text-foreground mt-4 truncate text-2xl font-extrabold">
                            {value}
                        </p>
                        <p className="mt-1 text-xs font-semibold opacity-75">
                            {detail}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Panel className="overflow-hidden">
                    <div className="border-border border-b px-4 py-4 sm:px-5">
                        <h2 className="text-lg font-extrabold">
                            Cảnh báo cần xử lý
                        </h2>
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
                            <div className="bg-brand-butter text-brand-forest grid size-10 place-items-center rounded-full">
                                <PackageCheck className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold">Tồn kho thấp</p>
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
                            <div className="grid size-10 place-items-center rounded-full bg-rose-100 text-rose-700">
                                <AlertTriangle className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold">Cận hạn sử dụng</p>
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
                    <h2 className="text-lg font-extrabold">Thao tác nhanh</h2>
                    <div className="mt-4 grid gap-2">
                        {canSell && (
                            <Link
                                to="/admin/sales"
                                className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors"
                            >
                                <ShoppingCart className="size-4" />
                                Tạo đơn bán
                                <ArrowRight className="ml-auto size-4" />
                            </Link>
                        )}
                        {canImport ? (
                            <Link
                                to="/admin/imports"
                                className="border-border hover:bg-muted flex h-11 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition-colors"
                            >
                                <PackagePlus className="size-4" />
                                Lập phiếu nhập
                                <ArrowRight className="ml-auto size-4" />
                            </Link>
                        ) : null}
                        <Link
                            to="/admin/inventory"
                            className="border-border hover:bg-muted flex h-11 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition-colors"
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
