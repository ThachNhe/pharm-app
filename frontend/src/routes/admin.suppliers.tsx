import { createFileRoute } from '@tanstack/react-router';
import { SuppliersPage } from '@/features/workspace/pages/SuppliersPage';

export const Route = createFileRoute('/admin/suppliers')({
    component: SuppliersPage,
});
