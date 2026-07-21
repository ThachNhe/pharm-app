import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/useAuthStore'
import { QUERY_KEYS, ROUTES } from '@/lib/constants'
import { authService } from '../services/auth.service.ts'
import type { LoginFormValues, RegisterFormValues } from '../types/auth.types.ts'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

// ─── useLogin ──────────────────────────────────────────────────────────────

export function useLogin() {
  const { login } = useAuthStore()
  const router = useRouter()

  return useMutation({
    mutationFn: ({ email, password }: LoginFormValues) =>
      authService.login({ email, password }),

    onSuccess: (data) => {
      login(data.user, data.accessToken)
      toast.success('Đăng nhập thành công', {
        description: `Chào mừng trở lại, ${data.user.name}!`,
      })
      router.navigate({ to: ROUTES.DASHBOARD })
    },

    onError: (error) => {
      toast.error('Đăng nhập thất bại', {
        description: getErrorMessage(error, 'Email hoặc mật khẩu không đúng'),
      })
    },
  })
}

// ─── useRegister ───────────────────────────────────────────────────────────

export function useRegister() {
  const router = useRouter()

  return useMutation({
    mutationFn: ({ name, email, password }: RegisterFormValues) =>
      authService.register({ name, email, password }),

    onSuccess: () => {
      toast.success('Đăng ký thành công', {
        description: 'Vui lòng kiểm tra email để xác nhận tài khoản.',
      })
      router.navigate({ to: ROUTES.LOGIN })
    },

    onError: (error) => {
      toast.error('Đăng ký thất bại', {
        description: getErrorMessage(error, 'Đã xảy ra lỗi, vui lòng thử lại'),
      })
    },
  })
}

// ─── useLogout ─────────────────────────────────────────────────────────────

export function useLogout() {
  const { logout } = useAuthStore()
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: authService.logout,

    onSettled: () => {
      // Always clear local state regardless of server response
      logout()
      queryClient.clear()
      router.navigate({ to: ROUTES.HOME })
    },

    onError: () => {
      toast.error('Lỗi đăng xuất', {
        description: 'Phiên của bạn đã được xóa cục bộ.',
      })
    },
  })
}

// ─── useMe ─────────────────────────────────────────────────────────────────

export function useMe() {
  const { isAuthenticated, setUser } = useAuthStore()

  return useQuery({
    queryKey: QUERY_KEYS.AUTH.ME,
    queryFn: async () => {
      const user = await authService.getMe()
      setUser(user) // keep store in sync
      return user
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
