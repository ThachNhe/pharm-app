import { useContext } from 'react';
import { WorkspaceStateContext } from './workspace-state';

export function useWorkspace() {
    const value = useContext(WorkspaceStateContext);
    if (!value) {
        throw new Error('useWorkspace must be used inside WorkspaceProvider');
    }
    return value;
}
