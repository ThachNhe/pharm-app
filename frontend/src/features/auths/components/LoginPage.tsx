import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { BarChart3, CalendarClock, ShieldCheck, ShoppingBag } from 'lucide-react'

import { BrandLogo } from '@/components/BrandLogo'
import { PharmacyHeroIllustration } from '@/components/illustrations'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import { LoginForm } from './LoginForm'

const highlights = [
  { label: 'Bán hàng theo FEFO', icon: ShoppingBag, tone: 'bg-brand-mint' },
  { label: 'Cảnh báo cận hạn', icon: CalendarClock, tone: 'bg-brand-butter' },
  { label: 'Phân quyền theo quầy', icon: ShieldCheck, tone: 'bg-brand-pistachio' },
  { label: 'Báo cáo lãi gộp', icon: BarChart3, tone: 'bg-brand-lavender' },
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
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-deep p-10 text-white lg:flex lg:flex-col xl:p-14">
        <BrandLogo markClassName="size-11" subtitle="Quản lý nhà thuốc" tone="inverse" />

        <div className="mt-12 max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-highlight uppercase">
            <span className="size-2 rounded-full bg-brand-highlight" />
            Dành cho nhà thuốc
          </p>
          <h2 className="mt-5 text-4xl leading-tight font-extrabold xl:text-5xl">
            Quản lý nhà thuốc gọn gàng, chính xác mỗi ngày
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-white/75">
            Nhập hàng, bán hàng và theo dõi tồn kho theo hạn dùng trên cùng một nơi, cho từng quầy.
          </p>
        </div>

        <PharmacyHeroIllustration className="mx-auto mt-auto max-w-md pt-8" />

        <ul className="mt-8 grid grid-cols-2 gap-3">
          {highlights.map(({ label, icon: Icon, tone }) => (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-foreground ${tone}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card/80">
                <Icon className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-10 xl:px-16">
        <header className="flex items-center justify-between gap-3">
          <BrandLogo className="lg:invisible" markClassName="size-10" subtitle="Quản lý nhà thuốc" />
          <ThemeSwitcher />
        </header>

        <div className="flex flex-1 items-center justify-center py-8">
          <LoginForm />
        </div>

        <footer className="pb-2 text-center text-xs text-muted-foreground">
          © 2026 {APP_NAME}. Không gian quản lý nhà thuốc an toàn.
        </footer>
      </section>
    </main>
  )
}
