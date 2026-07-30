import { createFileRoute } from '@tanstack/react-router';
import { InventoryPage } from '@/features/workspace/pages/InventoryPage';

type InventorySearch = {
    alert?: 'low' | 'expiring';
};

export const Route = createFileRoute('/admin/inventory')({
    validateSearch: (search: Record<string, unknown>): InventorySearch => ({
        alert:
            search.alert === 'low' || search.alert === 'expiring'
                ? search.alert
                : undefined,
    }),
    component: InventoryRoute,
});

function InventoryRoute() {
    const { alert } = Route.useSearch();
    return <InventoryPage initialAlert={alert ?? ''} />;
}
