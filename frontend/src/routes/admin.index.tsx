import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/features/workspace/pages/DashboardPage';

export const Route = createFileRoute('/admin/')({
    component: DashboardPage,
});
