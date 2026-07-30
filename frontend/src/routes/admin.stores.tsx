import { createFileRoute } from '@tanstack/react-router';
import { StoresPage } from '@/features/workspace/pages/StoresPage';

export const Route = createFileRoute('/admin/stores')({
    component: StoresPage,
});
