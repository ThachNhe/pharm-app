/**
 * Centralized API endpoints.
 * All endpoints are defined here to avoid magic strings scattered across the codebase.
 *
 * Usage:
 *   import { API_ENDPOINTS } from '@/services/endpoints'
 *   api.get(API_ENDPOINTS.USERS.LIST)
 *   api.get(API_ENDPOINTS.USERS.BY_ID(userId))
 */

export const API_ENDPOINTS = {
    // ─── Auth ────────────────────────────────────────────────────────────────
    AUTH: {
        LOGIN: '/auth/login',
        VERIFY_LOGIN_OTP: '/auth/verify-login-otp',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh-tokens',
        ME: '/auth/me',
    },

    // ─── Users ───────────────────────────────────────────────────────────────
    USERS: {
        LIST: '/users',
        BY_ID: (id: string) => `/users/${id}`,
        CREATE: '/users',
        UPDATE: (id: string) => `/users/${id}`,
        DELETE: (id: string) => `/users/${id}`,
        AVATAR: (id: string) => `/users/${id}/avatar`,
    },

    ADMIN: {
        ME: '/admin/me',
        DASHBOARD: '/admin/dashboard',
        STORES: '/admin/stores',
        STORE: (id: string) => `/admin/stores/${id}`,
        USERS: '/admin/users',
        USER: (id: string) => `/admin/users/${id}`,
        RESET_PASSWORD: (id: string) => `/admin/users/${id}/reset-password`,
        MEDICINES: '/admin/medicines',
        MEDICINE: (id: string) => `/admin/medicines/${id}`,
        IMPORT_RECEIPTS: '/admin/import-receipts',
        SALES: '/admin/sales',
        PROFIT_REPORT: '/admin/reports/profit',
    },

    OPERATIONS: {
        CONTEXT: '/stores/context',
        DASHBOARD: (storeId: string) => `/stores/${storeId}/dashboard`,
        SUPPLIERS: (storeId: string) => `/stores/${storeId}/suppliers`,
        SUPPLIER: (storeId: string, supplierId: string) =>
            `/stores/${storeId}/suppliers/${supplierId}`,
        PRODUCT_CATEGORIES: (storeId: string) =>
            `/stores/${storeId}/product-categories`,
        PRODUCT_CATEGORY: (storeId: string, categoryId: string) =>
            `/stores/${storeId}/product-categories/${categoryId}`,
        MEDICINES: (storeId: string) => `/stores/${storeId}/medicines`,
        NEXT_MEDICINE_CODE: (storeId: string) =>
            `/stores/${storeId}/medicines/next-code`,
        MEDICINE: (storeId: string, medicineId: string) =>
            `/stores/${storeId}/medicines/${medicineId}`,
        REFERENCE_PRODUCTS: (storeId: string) =>
            `/stores/${storeId}/reference-products`,
        IMPORTS: (storeId: string) => `/stores/${storeId}/imports`,
        IMPORT: (storeId: string, receiptId: string) =>
            `/stores/${storeId}/imports/${receiptId}`,
        COMPLETE_IMPORT: (storeId: string, receiptId: string) =>
            `/stores/${storeId}/imports/${receiptId}/complete`,
        CANCEL_IMPORT: (storeId: string, receiptId: string) =>
            `/stores/${storeId}/imports/${receiptId}/cancel`,
        INVENTORY: (storeId: string) => `/stores/${storeId}/inventory`,
        INVENTORY_MOVEMENTS: (storeId: string) =>
            `/stores/${storeId}/inventory/movements`,
        SALES: (storeId: string) => `/stores/${storeId}/sales`,
        SALE: (storeId: string, saleId: string) =>
            `/stores/${storeId}/sales/${saleId}`,
        PROFIT_REPORT: (storeId: string) => `/stores/${storeId}/reports/profit`,
    },
} as const;
