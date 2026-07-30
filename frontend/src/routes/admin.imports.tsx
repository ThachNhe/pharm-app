import { createFileRoute } from '@tanstack/react-router';
import { ImportsPage } from '@/features/workspace/pages/ImportsPage';

export const Route = createFileRoute('/admin/imports')({
    component: ImportsPage,
});
