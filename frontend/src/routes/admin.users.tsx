import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '@/features/workspace/pages/UsersPage';

export const Route = createFileRoute('/admin/users')({
    component: UsersPage,
});
