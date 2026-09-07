import { useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { STORE_ROLE_RANK } from '../constants/workspace.constants';
import { useWorkspaceContextQuery } from '../hooks/useWorkspace';
import {
    WorkspaceStateContext,
    type WorkspaceValue,
} from './workspace-context';

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
            canSell: !isSystemAdmin && Boolean(selectedStore?.role),
            canImport:
                !isSystemAdmin &&
                Boolean(
                    selectedStore?.role &&
                    STORE_ROLE_RANK[selectedStore.role] >=
                        STORE_ROLE_RANK.manager
                ),
            hasRole: (minimumRole) =>
                isSystemAdmin ||
                Boolean(
                    selectedStore?.role &&
                    STORE_ROLE_RANK[selectedStore.role] >=
                        STORE_ROLE_RANK[minimumRole]
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
