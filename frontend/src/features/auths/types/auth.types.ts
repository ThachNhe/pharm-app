
import type { User } from '@/types/common.types'

// ─── Auth State ────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface AuthSession {
  user: User
  tokens: AuthTokens
}

// ─── Form Values ───────────────────────────────────────────────────────────

export interface LoginFormValues {
  email: string
  password: string
  rememberMe?: boolean
}

export interface LoginOtpFormValues {
  code: string
}

// ─── API Payloads ──────────────────────────────────────────────────────────

export type LoginPayload = Omit<LoginFormValues, 'rememberMe'>
export interface VerifyLoginOtpPayload {
  challengeId: string
  code: string
}
// ─── API Responses ─────────────────────────────────────────────────────────

export interface LoginApiResponse {
  user: User
  accessToken: string
  expiresIn: number
}

export interface LoginChallengeResponse {
  twoFactorRequired: true
  challengeId: string
  email: string
  expiresAt: string
}

export interface BackendLoginApiResponse {
  user: User
  tokens: {
    access: {
      token: string
      expires: string
    }
  }
}
