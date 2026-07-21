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
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh-tokens',
    ME: '/auth/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
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
} as const
