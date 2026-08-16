import { createContext } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { StoreRole, WorkspaceContext, WorkspaceStore } from '../types';

export interface WorkspaceValue {
    contextQuery: UseQueryResult<WorkspaceContext, Error>;
    selectedStore: WorkspaceStore | null;
    selectedStoreId: string;
    setSelectedStoreId: (storeId: string) => void;
    isSystemAdmin: boolean;
    hasRole: (minimumRole: StoreRole) => boolean;
}

export const WorkspaceStateContext = createContext<WorkspaceValue | null>(null);
