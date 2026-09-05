import { createFileRoute } from '@tanstack/react-router';
import { StoreDetailsPage } from '@/features/workspace/pages/StoreDetailsPage';

export const Route = createFileRoute('/admin/store')({
    component: StoreDetailsPage,
});
