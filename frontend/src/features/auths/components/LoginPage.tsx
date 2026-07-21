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
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="hidden min-h-screen flex-col justify-between overflow-hidden bg-brand-navy px-10 py-8 text-white lg:flex xl:px-14">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Pill className="size-6 text-brand-mint" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-normal">{APP_NAME}</p>
            <p className="text-sm text-white/70">Pharmacy management</p>
          </div>
        </div>

        <div className="max-w-2xl space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 ring-1 ring-white/15">
              <LockKeyhole className="size-4 text-brand-amber" />
              Đăng nhập an toàn cho nhân sự nhà thuốc
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal xl:text-5xl">
                Quản lý nhà thuốc gọn hơn trong mỗi ca trực.
              </h1>
              <p className="max-w-xl text-base leading-7 text-white/70">
                Một nền giao diện nhất quán cho đơn thuốc, tồn kho, nhân sự và
                các nghiệp vụ bán hàng hằng ngày.
              </p>
            </div>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3">
            {metrics.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-xl shadow-black/10"
              >
                <div
                  className={`mb-4 h-1.5 w-12 rounded-full ${item.tone}`}
                />
                <p className="text-3xl font-semibold leading-none">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-5 text-white/70">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid max-w-3xl grid-cols-3 gap-4">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-white/15 bg-white/10 p-4"
            >
              <Icon className="mb-4 size-5 text-brand-mint" />
              <p className="font-medium">{title}</p>
              <p className="mt-2 text-sm leading-5 text-white/60">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

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
