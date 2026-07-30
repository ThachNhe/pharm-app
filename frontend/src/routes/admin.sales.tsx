import { createFileRoute } from '@tanstack/react-router';
import { SalesPage } from '@/features/workspace/pages/SalesPage';

export const Route = createFileRoute('/admin/sales')({
    component: SalesPage,
});
