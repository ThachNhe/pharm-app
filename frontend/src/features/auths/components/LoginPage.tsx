import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

import { BrandLogo } from '@/components/BrandLogo'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import { LoginForm } from './LoginForm'

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
        <header className="flex items-center">
          <BrandLogo
            markClassName="size-10"
            subtitle="Quản lý nhà thuốc"
          />
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
