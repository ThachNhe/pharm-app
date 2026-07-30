import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import { workspaceService } from './services/workspace.service';
import type { StoreRole } from './types';
import { WorkspaceStateContext, type WorkspaceValue } from './workspace-state';

const ROLE_RANK: Record<StoreRole, number> = {
    staff: 1,
    manager: 2,
    owner: 3,
};

const useWorkspaceContextQuery = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return useQuery({
        queryKey: ['workspace', 'context'],
        queryFn: workspaceService.getContext,
        enabled: isAuthenticated,
        retry: false,
    });
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const contextQuery = useWorkspaceContextQuery();
    const [selectedStoreId, setSelectedStoreIdState] = useState(
        () => localStorage.getItem(STORAGE_KEYS.SELECTED_STORE) ?? ''
    );

    const stores = useMemo(
        () => contextQuery.data?.stores ?? [],
        [contextQuery.data?.stores]
    );
    const preferredStore = stores.find(
        (store) => store.id === selectedStoreId && store.isActive
    );
    const selectedStore =
        preferredStore ??
        stores.find((store) => store.isActive) ??
        stores[0] ??
        null;
    const effectiveStoreId = selectedStore?.id ?? '';

    const setSelectedStoreId = (storeId: string) => {
        setSelectedStoreIdState(storeId);
        localStorage.setItem(STORAGE_KEYS.SELECTED_STORE, storeId);
    };

    const isSystemAdmin = contextQuery.data?.user.isSystemAdmin ?? false;

    const value = useMemo<WorkspaceValue>(
        () => ({
            contextQuery,
            selectedStore,
            selectedStoreId: effectiveStoreId,
            setSelectedStoreId,
            isSystemAdmin,
            hasRole: (minimumRole) =>
                isSystemAdmin ||
                Boolean(
                    selectedStore?.role &&
                    ROLE_RANK[selectedStore.role] >= ROLE_RANK[minimumRole]
                ),
        }),
        [contextQuery, effectiveStoreId, isSystemAdmin, selectedStore]
    );

    return (
        <WorkspaceStateContext.Provider value={value}>
            {children}
        </WorkspaceStateContext.Provider>
    );
}
