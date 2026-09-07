import { createFileRoute } from '@tanstack/react-router';
import { SystemDashboardPage } from '@/features/workspace/pages/SystemDashboardPage';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { DashboardPage } from '@/features/workspace/pages/DashboardPage';

export const Route = createFileRoute('/admin/')({
    component: DashboardRoute,
});

function DashboardRoute() {
    const { isSystemAdmin } = useWorkspace();
    return isSystemAdmin ? <SystemDashboardPage /> : <DashboardPage />;
}
