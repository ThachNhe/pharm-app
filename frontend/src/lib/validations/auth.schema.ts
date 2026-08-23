import { z } from 'zod'

// ─── Reusable fields ───────────────────────────────────────────────────────

const emailField = z
  .string()
  .min(1, 'Email là bắt buộc')
  .email('Email không hợp lệ')
  .toLowerCase()
  .trim()

// ─── Schemas ───────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
})

export const loginOtpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Mã xác minh gồm 6 chữ số'),
})

// ─── Inferred Types ────────────────────────────────────────────────────────

export type LoginFormValues = z.infer<typeof loginSchema>
export type LoginOtpFormValues = z.infer<typeof loginOtpSchema>
