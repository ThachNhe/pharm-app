// ─── App ───────────────────────────────────────────────────────────────────

export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'My App'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'
export const APP_ENV = import.meta.env.MODE // 'development' | 'production'
export const IS_DEV = APP_ENV === 'development'

// ─── Routes ────────────────────────────────────────────────────────────────

export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Protected
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',

  // Users
  USERS: '/users',
  USER_DETAIL: (id: string) => `/users/${id}`,
} as const

// ─── Pagination ────────────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  LIMIT_OPTIONS: [10, 20, 50, 100],
} as const

// ─── Query Keys ────────────────────────────────────────────────────────────
// Centralize TanStack Query keys to avoid typos and enable easy invalidation

export const QUERY_KEYS = {
  AUTH: {
    ME: ['auth', 'me'] as const,
  },
  USERS: {
    ALL: ['users'] as const,
    LIST: (params?: object) => ['users', 'list', params] as const,
    DETAIL: (id: string) => ['users', 'detail', id] as const,
  },
  // Add more as needed
} as const

// ─── Local Storage Keys ────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  AUTH: 'auth-storage',
  UI: 'ui-storage',
  THEME: 'theme',
} as const

// ─── HTTP Status ───────────────────────────────────────────────────────────

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const
