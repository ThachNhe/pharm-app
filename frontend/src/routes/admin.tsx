import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceShell } from '@/features/workspace/components/WorkspaceShell';

export const Route = createFileRoute('/admin')({
    component: WorkspaceShell,
});
