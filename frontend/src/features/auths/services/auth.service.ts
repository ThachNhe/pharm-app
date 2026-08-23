import { apiPost, apiGet } from '@/services/api'
import { API_ENDPOINTS } from '@/services/endpoints'
import type {
  LoginPayload,
  VerifyLoginOtpPayload,
  LoginApiResponse,
  LoginChallengeResponse,
  BackendLoginApiResponse,
} from '../types/auth.types'
import type { User } from '@/types/common.types'
import type { ApiResponse } from '@/types/api.types'

// ─── Auth Service ──────────────────────────────────────────────────────────

export const authService = {
  /**
   * Login with email & password
   * Returns an OTP challenge. Auth tokens are issued after OTP verification.
   */
  login: (payload: LoginPayload) =>
    apiPost<LoginChallengeResponse>(API_ENDPOINTS.AUTH.LOGIN, payload),

  /**
   * Verify the login OTP challenge and receive the auth session.
   */
  verifyLoginOtp: async (
    payload: VerifyLoginOtpPayload,
  ): Promise<LoginApiResponse> => {
    const data = await apiPost<BackendLoginApiResponse>(
      API_ENDPOINTS.AUTH.VERIFY_LOGIN_OTP,
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
}
