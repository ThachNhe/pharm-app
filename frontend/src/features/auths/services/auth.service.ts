import { apiPost, apiGet } from '@/services/api'
import { API_ENDPOINTS } from '@/services/endpoints'
import type {
  LoginPayload,
  RegisterPayload,
  LoginApiResponse,
  RegisterApiResponse,
} from '../types/auth.types'
import type { User } from '@/types/common.types'
import type { ApiResponse } from '@/types/api.types'

// ─── Auth Service ──────────────────────────────────────────────────────────

export const authService = {
  /**
   * Login with email & password
   * Returns user info + tokens
   */
  login: (payload: LoginPayload) =>
    apiPost<LoginApiResponse>(API_ENDPOINTS.AUTH.LOGIN, payload),

  /**
   * Register a new account
   */
  register: (payload: RegisterPayload) =>
    apiPost<RegisterApiResponse>(API_ENDPOINTS.AUTH.REGISTER, payload),

  /**
   * Logout - invalidate token on server
   */
  logout: () =>
    apiPost<ApiResponse>(API_ENDPOINTS.AUTH.LOGOUT),

  /**
   * Get current authenticated user
   */
  getMe: () =>
    apiGet<User>(API_ENDPOINTS.AUTH.ME),

  /**
   * Send forgot password email
   */
  forgotPassword: (email: string) =>
    apiPost<ApiResponse>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email }),

  /**
   * Reset password with token from email
   */
  resetPassword: (token: string, password: string) =>
    apiPost<ApiResponse>(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      password,
    }),
}
