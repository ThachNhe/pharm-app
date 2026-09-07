import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { adminService } from '@/features/admin/services/admin.service';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
    ErrorState,
    LoadingState,
    PageHeader,
    Panel,
} from '../components/shared';

export function SystemDashboardPage() {
    const query = useQuery({
        queryKey: ['admin', 'dashboard'],
        queryFn: adminService.getDashboard,
    });
    if (query.isPending)
        return <LoadingState label="Đang tổng hợp dữ liệu hệ thống" />;
    if (query.isError)
        return (
            <Panel>
                <ErrorState onRetry={() => void query.refetch()} />
            </Panel>
        );
    const data = query.data;
    const metrics = [
        ['Quầy đang hoạt động', formatNumber(data.storeCount)],
        ['Tài khoản đang hoạt động', formatNumber(data.activeUserCount)],
        ['Thuốc trong danh mục', formatNumber(data.medicineCount)],
        ['Doanh thu 30 ngày', formatCurrency(data.revenue30Days)],
        ['Lợi nhuận 30 ngày', formatCurrency(data.profit30Days)],
        ['Đơn bán 30 ngày', formatNumber(data.orders30Days)],
    ];
    return (
        <div className="space-y-5">
            <PageHeader
                title="Tổng quan hệ thống"
                description="Quản lý quầy, tài khoản và theo dõi kết quả kinh doanh toàn hệ thống."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map(([label, value]) => (
                    <Panel key={label} className="min-w-0 p-4">
                        <p className="text-muted-foreground text-sm">{label}</p>
                        <p className="mt-2 text-2xl font-semibold break-words">
                            {value}
                        </p>
                    </Panel>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button asChild>
                    <Link to="/admin/stores">Quản lý quầy</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link to="/admin/users">Quản lý tài khoản</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link to="/admin/reports">Xem báo cáo</Link>
                </Button>
            </div>
        </div>
    );
}
