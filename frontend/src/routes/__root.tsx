import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Toaster } from 'sonner'
import { AuthBootstrap } from '@/components/AuthBootstrap'

const showDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

export const Route = createRootRoute({
  component: () => (
    <>
      <AuthBootstrap />
      <Outlet />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ duration: 4500 }}
      />
      {showDevtools ? <TanStackRouterDevtools /> : null}
    </>
  ),
})
