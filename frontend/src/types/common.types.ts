// ─── User ─────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user' | 'moderator'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

// ─── Pagination ────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── Sort & Filter ─────────────────────────────────────────────────────────

export type SortOrder = 'asc' | 'desc'

export interface SortParams {
  sortBy: string
  sortOrder: SortOrder
}

// ─── Select Option ─────────────────────────────────────────────────────────

export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
}

// ─── Key-Value ─────────────────────────────────────────────────────────────

export type KeyValue<T = string> = Record<string, T>

// ─── Nullable helpers ──────────────────────────────────────────────────────

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Maybe<T> = T | null | undefined
