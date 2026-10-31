import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Toaster } from 'sonner'
import { AuthBootstrap } from '@/components/AuthBootstrap'
import { ThemeBootstrap } from '@/components/ThemeBootstrap'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

const showDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

function RootLayout() {
  const resolvedTheme = useResolvedTheme()
  return (
    <>
      <ThemeBootstrap />
      <AuthBootstrap />
      <Outlet />
      <Toaster
        position="top-right"
        theme={resolvedTheme}
        richColors
        closeButton
        toastOptions={{ duration: 4500 }}
      />
      {showDevtools ? <TanStackRouterDevtools /> : null}
    </>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
