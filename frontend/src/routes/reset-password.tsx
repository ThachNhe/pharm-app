import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '@/features/auths/components/ResetPasswordPage'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})
