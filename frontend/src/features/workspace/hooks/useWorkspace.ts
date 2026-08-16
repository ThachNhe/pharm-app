import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { WorkspaceStateContext } from '../context/workspace-context';
import { workspaceService } from '../services/workspace.service';

export function useWorkspaceContextQuery() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return useQuery({
        queryKey: ['workspace', 'context'],
        queryFn: workspaceService.getContext,
        enabled: isAuthenticated,
        retry: false,
    });
}

export function useWorkspace() {
    const value = useContext(WorkspaceStateContext);
    if (!value) {
        throw new Error('useWorkspace must be used inside WorkspaceProvider');
    }
    return value;
}
