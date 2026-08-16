import type { StoreRole } from '../types';

export const STORE_ROLE_RANK: Record<StoreRole, number> = {
    staff: 1,
    manager: 2,
    owner: 3,
};

export const STORE_ROLE_LABELS: Record<StoreRole, string> = {
    owner: 'Chủ quầy',
    manager: 'Quản lý',
    staff: 'Nhân viên',
};
