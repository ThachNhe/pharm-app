import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { AuthBootstrap } from '@/components/AuthBootstrap'
import { ToastViewport } from '@/components/ToastViewport'

export const Route = createRootRoute({
  component: () => (
    <>
      <AuthBootstrap />
      <Outlet />
      <ToastViewport />
      <TanStackRouterDevtools />
    </>
  ),
})
