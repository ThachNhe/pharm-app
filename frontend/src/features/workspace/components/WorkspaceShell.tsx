import { useEffect, useState } from 'react';
import {
    BarChart3,
    Boxes,
    Building2,
    LayoutDashboard,
    Library,
    LogOut,
    Menu,
    PackagePlus,
    Pill,
    RefreshCw,
    ShoppingCart,
    Truck,
    UserRoundCog,
    X,
} from 'lucide-react';
import {
    Link,
    Outlet,
    useNavigate,
    useRouterState,
} from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn, getInitials } from '@/lib/utils';
import { authService } from '@/features/auths/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';
import { WorkspaceProvider } from '../WorkspaceContext';
import { useWorkspace } from '../useWorkspace';
import type { StoreRole } from '../types';
import { ErrorState, LoadingState, Panel, StatusBadge } from './shared';

type NavItem = {
    label: string;
    to:
        | '/admin'
        | '/admin/stores'
        | '/admin/users'
        | '/admin/medicines'
        | '/admin/medicine-library'
        | '/admin/suppliers'
        | '/admin/imports'
        | '/admin/inventory'
        | '/admin/sales'
        | '/admin/reports';
    icon: typeof LayoutDashboard;
    minimumRole?: StoreRole;
    systemOnly?: boolean;
};

const navItems: NavItem[] = [
    {
        label: 'Tổng quan',
        to: '/admin',
        icon: LayoutDashboard,
        minimumRole: 'staff',
    },
    {
        label: 'Bán hàng',
        to: '/admin/sales',
        icon: ShoppingCart,
        minimumRole: 'staff',
    },
    {
        label: 'Tồn kho',
        to: '/admin/inventory',
        icon: Boxes,
        minimumRole: 'staff',
    },
    {
        label: 'Danh mục thuốc',
        to: '/admin/medicines',
        icon: Pill,
        minimumRole: 'staff',
    },
    {
        label: 'Thư viện thuốc',
        to: '/admin/medicine-library',
        icon: Library,
        minimumRole: 'staff',
    },
    {
        label: 'Nhập hàng',
        to: '/admin/imports',
        icon: PackagePlus,
        minimumRole: 'manager',
    },
    {
        label: 'Nhà cung cấp',
        to: '/admin/suppliers',
        icon: Truck,
        minimumRole: 'manager',
    },
    {
        label: 'Tài khoản',
        to: '/admin/users',
        icon: UserRoundCog,
        minimumRole: 'manager',
    },
    {
        label: 'Báo cáo',
        to: '/admin/reports',
        icon: BarChart3,
        minimumRole: 'manager',
    },
    {
        label: 'Quầy thuốc',
        to: '/admin/stores',
        icon: Building2,
        systemOnly: true,
    },
];

const roleLabels: Record<StoreRole, string> = {
    owner: 'Chủ quầy',
    manager: 'Quản lý',
    staff: 'Nhân viên',
};

function WorkspaceShellContent() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const { isAuthenticated, isHydrating, logout } = useAuthStore();
    const {
        contextQuery,
        selectedStore,
        selectedStoreId,
        setSelectedStoreId,
        isSystemAdmin,
        hasRole,
    } = useWorkspace();

    useEffect(() => {
        if (!isHydrating && !isAuthenticated) {
            void navigate({ to: ROUTES.LOGIN, replace: true });
        }
    }, [isAuthenticated, isHydrating, navigate]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    if (isHydrating || (!isAuthenticated && !isHydrating)) {
        return (
            <main className="bg-background grid min-h-screen place-items-center">
                <LoadingState label="Đang khôi phục phiên đăng nhập" />
            </main>
        );
    }

    if (contextQuery.isPending) {
        return (
            <main className="bg-background grid min-h-screen place-items-center">
                <LoadingState label="Đang tải không gian làm việc" />
            </main>
        );
    }

    if (contextQuery.isError || !contextQuery.data) {
        return (
            <main className="bg-background grid min-h-screen place-items-center p-4">
                <Panel className="w-full max-w-md">
                    <ErrorState
                        title="Không thể mở không gian làm việc"
                        description="Phiên đăng nhập có thể đã hết hạn hoặc tài khoản không còn hoạt động."
                        onRetry={() => void contextQuery.refetch()}
                    />
                </Panel>
            </main>
        );
    }

    const visibleItems = navItems.filter((item) => {
        if (item.systemOnly) return isSystemAdmin;
        return item.minimumRole ? hasRole(item.minimumRole) : true;
    });

    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch {
            // Local logout must still complete when the server session is gone.
        } finally {
            logout();
            queryClient.clear();
            toast.success('Đã đăng xuất');
            void navigate({ to: ROUTES.LOGIN, replace: true });
        }
    };

    const navigation = (
        <nav className="space-y-1" aria-label="Điều hướng chính">
            {visibleItems.map(({ label, to, icon: Icon }) => {
                const active =
                    to === '/admin' ? pathname === to : pathname.startsWith(to);
                return (
                    <Link
                        key={to}
                        to={to}
                        className={cn(
                            'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                            active
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                        )}
                    >
                        <Icon className="size-4" />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="bg-background text-foreground min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="border-sidebar-border bg-sidebar hidden min-h-screen border-r px-4 py-5 lg:block">
                <BrandLogo
                    className="mb-7 h-11 px-2"
                    markClassName="size-9"
                    subtitle="Quản lý nhà thuốc"
                />
                {navigation}
            </aside>

            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Đóng menu"
                    />
                    <aside className="border-sidebar-border bg-sidebar relative h-full w-[min(82vw,300px)] border-r p-4 shadow-xl">
                        <div className="mb-6 flex h-11 items-center justify-between">
                            <BrandLogo markClassName="size-9" />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setMobileMenuOpen(false)}
                                aria-label="Đóng menu"
                            >
                                <X />
                            </Button>
                        </div>
                        {navigation}
                    </aside>
                </div>
            ) : null}

            <div className="min-w-0">
                <header className="border-border bg-card/95 sticky top-0 z-30 border-b backdrop-blur">
                    <div className="flex min-h-16 items-center gap-3 px-4 lg:px-6">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="lg:hidden"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Mở menu"
                        >
                            <Menu />
                        </Button>

                        <div className="min-w-0 flex-1">
                            <label
                                className="sr-only"
                                htmlFor="workspace-store"
                            >
                                Quầy đang làm việc
                            </label>
                            <select
                                id="workspace-store"
                                value={selectedStoreId}
                                onChange={(event) => {
                                    setSelectedStoreId(event.target.value);
                                    void queryClient.invalidateQueries({
                                        queryKey: ['workspace'],
                                    });
                                }}
                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 max-w-full rounded-md border px-3 text-sm font-medium outline-none focus:ring-3 sm:w-72"
                            >
                                {contextQuery.data.stores.map((store) => (
                                    <option key={store.id} value={store.id}>
                                        {store.name}
                                        {!store.isActive
                                            ? ' (ngừng hoạt động)'
                                            : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden items-center gap-2 sm:flex">
                            <StatusBadge
                                tone={isSystemAdmin ? 'info' : 'success'}
                            >
                                {isSystemAdmin
                                    ? 'System Admin'
                                    : selectedStore?.role
                                      ? roleLabels[selectedStore.role]
                                      : 'Chưa có vai trò'}
                            </StatusBadge>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                    void queryClient.invalidateQueries({
                                        queryKey: ['workspace'],
                                    })
                                }
                                aria-label="Làm mới dữ liệu"
                                title="Làm mới dữ liệu"
                            >
                                <RefreshCw />
                            </Button>
                        </div>

                        <div className="border-border hidden min-w-0 items-center gap-2 border-l pl-3 md:flex">
                            <div className="bg-brand-navy grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white">
                                {getInitials(contextQuery.data.user.name)}
                            </div>
                            <div className="min-w-0">
                                <p className="max-w-36 truncate text-sm font-medium">
                                    {contextQuery.data.user.name}
                                </p>
                                <p className="text-muted-foreground max-w-36 truncate text-xs">
                                    {contextQuery.data.user.email}
                                </p>
                            </div>
                        </div>

                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleLogout}
                            aria-label="Đăng xuất"
                            title="Đăng xuất"
                        >
                            <LogOut />
                        </Button>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 lg:p-6">
                    {contextQuery.data.stores.length === 0 ? (
                        isSystemAdmin && pathname === '/admin/stores' ? (
                            <Outlet key={selectedStoreId || 'no-store'} />
                        ) : (
                            <Panel>
                                <ErrorState
                                    title="Chưa có quầy thuốc"
                                    description={
                                        isSystemAdmin
                                            ? 'Mở mục Quầy thuốc để tạo quầy đầu tiên.'
                                            : 'Liên hệ System Admin để được phân quyền vào một quầy.'
                                    }
                                />
                            </Panel>
                        )
                    ) : (
                        <Outlet key={selectedStoreId} />
                    )}
                </main>
            </div>
        </div>
    );
}

export function WorkspaceShell() {
    return (
        <WorkspaceProvider>
            <WorkspaceShellContent />
        </WorkspaceProvider>
    );
}
