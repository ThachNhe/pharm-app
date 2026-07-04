import { z } from 'zod'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// ─── Schemas ───────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên phải có ít nhất 2 ký tự')
    .max(50, 'Tên không được quá 50 ký tự')
    .trim(),
  email: z
    .string()
    .min(1, 'Email là bắt buộc')
    .email('Email không hợp lệ')
    .toLowerCase()
    .trim(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 số'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export const uploadAvatarSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_FILE_SIZE, 'File không được vượt quá 5MB')
    .refine(
      (f) => ACCEPTED_IMAGE_TYPES.includes(f.type),
      'Chỉ chấp nhận file .jpg, .jpeg, .png, .webp',
    ),
})

// ─── Admin: Create/Edit User ───────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['admin', 'user', 'moderator']),
  password: z.string().min(8),
})

export const updateUserSchema = createUserSchema.partial().omit({ password: true })

// ─── Inferred Types ────────────────────────────────────────────────────────

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export type UploadAvatarFormValues = z.infer<typeof uploadAvatarSchema>
export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
