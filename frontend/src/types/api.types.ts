import type { PaginationMeta } from './common.types'

// ─── Base API Response ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T
  message: string
  success: boolean
}

export interface ApiErrorResponse {
  message: string
  success: false
  errors?: Record<string, string[]> // field-level validation errors
  code?: string                      // error code (e.g. "UNAUTHORIZED")
}

// ─── Paginated Response ────────────────────────────────────────────────────

export interface PaginatedResponse<T = unknown> {
  data: T[]
  meta: PaginationMeta
  message: string
  success: boolean
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
}

// ─── Query Params helper ───────────────────────────────────────────────────

export interface ListQueryParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
