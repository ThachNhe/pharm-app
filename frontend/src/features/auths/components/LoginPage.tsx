import {
  Activity,
  LockKeyhole,
  PackageCheck,
  Pill,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

import { APP_NAME, ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import { LoginForm } from './LoginForm'

const metrics = [
  { label: 'Đơn thuốc chờ xử lý', value: '24', tone: 'bg-brand-mint/20' },
  { label: 'Sản phẩm cần nhập', value: '08', tone: 'bg-brand-amber/25' },
  { label: 'Ca trực hôm nay', value: '03', tone: 'bg-white/15' },
]

const highlights = [
  {
    icon: PackageCheck,
    title: 'Tồn kho rõ ràng',
    description: 'Theo dõi thuốc, lô hàng và hạn dùng trong một luồng.',
  },
  {
    icon: Activity,
    title: 'Vận hành theo ca',
    description: 'Ưu tiên những việc cần xử lý trước trong ngày.',
  },
  {
    icon: ShieldCheck,
    title: 'Dữ liệu bảo mật',
    description: 'Phân quyền truy cập theo vai trò của từng nhân sự.',
  },
]

export function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrating } = useAuthStore()

  useEffect(() => {
    if (!isHydrating && isAuthenticated) {
      void router.navigate({ to: ROUTES.DASHBOARD })
    }
  }, [isAuthenticated, isHydrating, router])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-10 xl:px-16">
        <header className="flex items-center gap-3 lg:hidden">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Pill className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">
              Pharmacy management
            </p>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-8">
          <LoginForm />
        </div>

        <footer className="pb-2 text-center text-xs text-muted-foreground">
          Copyright 2026 {APP_NAME}. Secure pharmacy workspace.
        </footer>
      </section>
    </main>
  )
}
