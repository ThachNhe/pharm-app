export type StoreRole = 'owner' | 'manager' | 'staff'

export interface Store {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  isActive: boolean
  _count?: {
    roles: number
  }
}

export interface AdminContext {
  user: {
    id: string
    name: string
    email: string
    phone?: string | null
    isSystemAdmin: boolean
    roles: Array<{
      storeId: string
      storeName: string
      role: StoreRole
    }>
  }
  stores: Store[]
}

export interface DashboardMetrics {
  storeCount: number
  activeUserCount: number
  medicineCount: number
  revenue30Days: number
  cost30Days: number
  profit30Days: number
  orders30Days: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  phone?: string | null
  isActive: boolean
  isSystemAdmin: boolean
  storeRoles: Array<{
    role: StoreRole
    store: {
      id: string
      name: string
    }
  }>
}

export interface MedicineUnit {
  id?: string
  name: string
  conversionRate: number
  isBaseUnit: boolean
}

export interface Medicine {
  id: string
  name: string
  baseUnitName: string
  barcode?: string | null
  registrationNumber?: string | null
  category?: string | null
  activeIngredient?: string | null
  strength?: string | null
  dosageForm?: string | null
  manufacturer?: string | null
  requiresPrescription: boolean
  description?: string | null
  isActive: boolean
  units: MedicineUnit[]
}

export interface AdminListResponse<T> {
  results: T[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export interface ProfitReport {
  source: 'daily_profit_summary' | 'sale_details'
  totals: {
    revenue: number
    cost: number
    profit: number
    orders: number
  }
  series: Array<{
    date: string
    revenue: number
    profit: number
  }>
}

export interface ImportReceipt {
  id: string
  importedAt: string
  totalAmount: number
  status: string
  store: { id: string; name: string }
  supplier?: { id: string; name: string } | null
  createdByUser: { id: string; name: string }
  details: Array<{
    id: string
    batchNumber: string
    quantity: number
    importPrice: number
    expiryDate: string
    medicine: { id: string; name: string; baseUnitName: string }
  }>
}

export interface Sale {
  id: string
  soldAt: string
  totalAmount: number
  status: string
  paymentMethod: string
  store: { id: string; name: string }
  soldByUser: { id: string; name: string }
  details: Array<{
    id: string
    quantity: number
    salePrice: number
    costPrice: number
    medicine: { id: string; name: string; baseUnitName: string }
  }>
}
