import { z } from 'zod'

// ─── Reusable fields ───────────────────────────────────────────────────────

const emailField = z
  .string()
  .min(1, 'Email là bắt buộc')
  .email('Email không hợp lệ')
  .toLowerCase()
  .trim()

const passwordField = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(100, 'Mật khẩu không được quá 100 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 số')

// ─── Schemas ───────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Tên phải có ít nhất 2 ký tự')
      .max(50, 'Tên không được quá 50 ký tự')
      .trim(),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    token: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

// ─── Inferred Types ────────────────────────────────────────────────────────

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
