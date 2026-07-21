import { apiPost, apiGet } from '@/services/api'
import { API_ENDPOINTS } from '@/services/endpoints'
import type {
  LoginPayload,
  RegisterPayload,
  LoginApiResponse,
  BackendLoginApiResponse,
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
  login: async (payload: LoginPayload): Promise<LoginApiResponse> => {
    const data = await apiPost<BackendLoginApiResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      payload,
    )

    return {
      user: data.user,
      accessToken: data.tokens.access.token,
      expiresIn: Math.max(
        0,
        Math.floor(
          (new Date(data.tokens.access.expires).getTime() - Date.now()) / 1000,
        ),
      ),
    }
  },

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
   * Refresh access token from the HttpOnly refresh cookie.
   */
  refreshSession: async (): Promise<LoginApiResponse> => {
    const data = await apiPost<BackendLoginApiResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      {},
    )

    return {
      user: data.user,
      accessToken: data.tokens.access.token,
      expiresIn: Math.max(
        0,
        Math.floor(
          (new Date(data.tokens.access.expires).getTime() - Date.now()) / 1000,
        ),
      ),
    }
  },

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
