import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '@/features/workspace/pages/UsersPage';

export const Route = createFileRoute('/admin/users')({
    validateSearch: (search: Record<string, unknown>) => ({
        storeId:
            typeof search.storeId === 'string' && search.storeId
                ? search.storeId
                : undefined,
    }),
    component: UsersRoute,
});

function UsersRoute() {
    const { storeId } = Route.useSearch();
    const navigate = Route.useNavigate();

    return (
        <UsersPage
            storeId={storeId}
            onStoreChange={(nextStoreId) =>
                void navigate({
                    search: nextStoreId ? { storeId: nextStoreId } : {},
                })
            }
        />
    );
}
