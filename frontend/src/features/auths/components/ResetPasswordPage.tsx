import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { Eye, EyeOff, KeyRound, Loader2, Pill } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { resetPasswordSchema } from '@/lib/validations/auth.schema'
import { authService } from '../services/auth.service'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

export function ResetPasswordPage() {
  const router = useRouter()
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get('token') ?? '',
    [],
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = resetPasswordSchema.safeParse({
      token,
      password,
      confirmPassword,
    })

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ'
      setFieldError(message)
      toast.error('Không thể đặt mật khẩu', { description: message })
      return
    }

    setFieldError(null)
    setIsSubmitting(true)
    try {
      await authService.resetPassword(result.data.token, result.data.password)
      toast.success('Đã thiết lập mật khẩu', {
        description: 'Bạn có thể đăng nhập bằng mật khẩu mới.',
      })
      await router.navigate({ to: ROUTES.HOME })
    } catch (error) {
      toast.error('Không thể đặt mật khẩu', {
        description: getErrorMessage(error, 'Liên kết có thể đã hết hạn.'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-md rounded-lg border-border/70 bg-card/95 shadow-2xl shadow-brand-navy/10">
        <CardHeader className="space-y-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Pill className="size-5" />
          </div>
          <CardTitle className="text-2xl">Thiết lập mật khẩu</CardTitle>
          <CardDescription>
            Tạo mật khẩu mới cho tài khoản {APP_NAME}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                aria-label="Mật khẩu mới"
                autoComplete="new-password"
                placeholder="Mật khẩu mới"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldError(null)
                }}
                disabled={isSubmitting}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((show) => !show)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                aria-label="Xác nhận mật khẩu"
                autoComplete="new-password"
                placeholder="Xác nhận mật khẩu"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setFieldError(null)
                }}
                disabled={isSubmitting}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((show) => !show)}
                aria-label={
                  showConfirmPassword
                    ? 'Ẩn xác nhận mật khẩu'
                    : 'Hiện xác nhận mật khẩu'
                }
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {fieldError ? (
              <p className="text-sm text-destructive">{fieldError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Đặt mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
