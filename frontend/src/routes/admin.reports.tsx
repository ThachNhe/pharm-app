import { createFileRoute } from '@tanstack/react-router';
import { ReportsPage } from '@/features/workspace/pages/ReportsPage';

export const Route = createFileRoute('/admin/reports')({
    component: ReportsPage,
});
