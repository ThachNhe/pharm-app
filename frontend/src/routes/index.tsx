import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '@/features/auths'

export const Route = createFileRoute('/')({
  component: LoginPage,
})
