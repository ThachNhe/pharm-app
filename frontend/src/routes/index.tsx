import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

function IndexRedirect() {
  const router = Route.useNavigate()
  const { isAuthenticated, isHydrating } = useAuthStore()

  useEffect(() => {
    if (isHydrating) return
    void router({ to: isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN })
  }, [isAuthenticated, isHydrating, router])

  return (
    <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Đang chuyển hướng...
    </main>
  )
}
