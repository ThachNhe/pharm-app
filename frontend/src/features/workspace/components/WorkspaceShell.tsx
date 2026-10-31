import { useEffect, useState } from 'react';
import { LogOut, Menu, RefreshCw, X } from 'lucide-react';
import {
    Link,
    Outlet,
    useNavigate,
    useRouterState,
} from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { CapsuleIllustration } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn, getInitials } from '@/lib/utils';
import { authService } from '@/features/auths/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';
import { STORE_ROLE_LABELS } from '../constants/workspace.constants';
import { WorkspaceProvider } from '../context/WorkspaceProvider';
import { useWorkspace } from '../hooks/useWorkspace';
import { workspaceRoutes } from '../constants/routes';
import {
    ErrorState,
    LoadingState,
    Panel,
    PermissionDenied,
    StatusBadge,
} from './shared';

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

    const visibleItems = workspaceRoutes.filter((item) => {
        if (isSystemAdmin) return item.systemOnly || item.systemAccess;
        if (item.systemOnly) return false;
        return item.minimumRole ? hasRole(item.minimumRole) : true;
    });

    const currentPath = pathname.replace(/\/$/, '') || '/';
    const routeAllowed = visibleItems.some((item) => item.to === currentPath);

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
                            'focus-visible:ring-sidebar-ring flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2',
                            active
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                    >
                        <Icon className="size-[1.125rem]" />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="bg-background text-foreground min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
            <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen flex-col overflow-y-auto px-4 py-5 lg:flex">
                <BrandLogo
                    className="mb-8 h-11 px-2"
                    markClassName="size-10"
                    subtitle="Quản lý nhà thuốc"
                    tone="inverse"
                />
                {navigation}
                <div className="mt-auto pt-6">
                    <div className="bg-sidebar-accent relative overflow-hidden rounded-2xl p-4">
                        <CapsuleIllustration className="absolute top-3 right-3 size-12" />
                        <p className="text-brand-lime text-xs font-bold tracking-wide uppercase">
                            FEFO
                        </p>
                        <p className="mt-1 pr-12 text-sm leading-5 font-semibold text-white">
                            Hàng gần hết hạn luôn được bán trước.
                        </p>
                    </div>
                </div>
            </aside>

            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Đóng menu"
                    />
                    <aside className="bg-sidebar text-sidebar-foreground relative h-full w-[min(82vw,300px)] overflow-y-auto p-4 shadow-xl">
                        <div className="mb-6 flex h-11 items-center justify-between">
                            <BrandLogo markClassName="size-9" tone="inverse" />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-white hover:bg-white/10 hover:text-white"
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
                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-10 max-w-full rounded-full border px-4 text-sm font-semibold outline-none focus:ring-3 sm:w-72"
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
                                      ? STORE_ROLE_LABELS[selectedStore.role]
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
                            <div className="bg-brand-forest ring-brand-mint grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ring-2">
                                {getInitials(contextQuery.data.user.name)}
                            </div>
                            <div className="min-w-0">
                                <p className="max-w-36 truncate text-sm font-bold">
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
                    {!routeAllowed ? (
                        <PermissionDenied />
                    ) : contextQuery.data.stores.length === 0 ? (
                        isSystemAdmin &&
                        ['/admin', '/admin/stores', '/admin/users'].includes(
                            currentPath
                        ) ? (
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
