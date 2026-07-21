import { apiGet, apiPatch, apiPost } from '@/services/api'
import { API_ENDPOINTS } from '@/services/endpoints'
import type {
  AdminContext,
  AdminListResponse,
  AdminUser,
  DashboardMetrics,
  ImportReceipt,
  Medicine,
  ProfitReport,
  Sale,
  Store,
} from '../types'

const cleanParams = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )

export const adminService = {
  getContext: () => apiGet<AdminContext>(API_ENDPOINTS.ADMIN.ME),
  getDashboard: () =>
    apiGet<DashboardMetrics>(API_ENDPOINTS.ADMIN.DASHBOARD),
  getStores: (params: Record<string, unknown>) =>
    apiGet<AdminListResponse<Store>>(
      API_ENDPOINTS.ADMIN.STORES,
      cleanParams(params),
    ),
  createStore: (payload: unknown) =>
    apiPost<{ store: Store; owner?: AdminUser }>(
      API_ENDPOINTS.ADMIN.STORES,
      payload,
    ),
  updateStore: (id: string, payload: unknown) =>
    apiPatch<Store>(API_ENDPOINTS.ADMIN.STORE(id), payload),
  getUsers: (params: Record<string, unknown>) =>
    apiGet<AdminListResponse<AdminUser>>(
      API_ENDPOINTS.ADMIN.USERS,
      cleanParams(params),
    ),
  createUser: (payload: unknown) =>
    apiPost<AdminUser>(API_ENDPOINTS.ADMIN.USERS, payload),
  updateUser: (id: string, payload: unknown) =>
    apiPatch<AdminUser>(API_ENDPOINTS.ADMIN.USER(id), payload),
  resetPassword: (id: string, payload: unknown) =>
    apiPost<{ message: string }>(API_ENDPOINTS.ADMIN.RESET_PASSWORD(id), payload),
  getMedicines: (params: Record<string, unknown>) =>
    apiGet<AdminListResponse<Medicine>>(
      API_ENDPOINTS.ADMIN.MEDICINES,
      cleanParams(params),
    ),
  createMedicine: (payload: unknown) =>
    apiPost<Medicine>(API_ENDPOINTS.ADMIN.MEDICINES, payload),
  updateMedicine: (id: string, payload: unknown) =>
    apiPatch<Medicine>(API_ENDPOINTS.ADMIN.MEDICINE(id), payload),
  getImportReceipts: (params: Record<string, unknown>) =>
    apiGet<AdminListResponse<ImportReceipt>>(
      API_ENDPOINTS.ADMIN.IMPORT_RECEIPTS,
      cleanParams(params),
    ),
  getSales: (params: Record<string, unknown>) =>
    apiGet<AdminListResponse<Sale>>(
      API_ENDPOINTS.ADMIN.SALES,
      cleanParams(params),
    ),
  getProfitReport: (params: Record<string, unknown>) =>
    apiGet<ProfitReport>(
      API_ENDPOINTS.ADMIN.PROFIT_REPORT,
      cleanParams(params),
    ),
}
