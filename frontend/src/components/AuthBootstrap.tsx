import { useEffect, useRef } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'
import { authService } from '@/features/auths/services/auth.service'
import { useAuthStore } from '@/stores/useAuthStore'

export function AuthBootstrap() {
  const hasBootstrapped = useRef(false)
  const { token, login, logout, setHydrating } = useAuthStore()

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.AUTH)

    if (token) {
      hasBootstrapped.current = true
      setHydrating(false)
      return
    }

    if (hasBootstrapped.current) {
      setHydrating(false)
      return
    }

    setHydrating(true)
    authService
      .refreshSession()
      .then((session) => {
        login(session.user, session.accessToken)
      })
      .catch(() => {
        logout()
      })
      .finally(() => {
        hasBootstrapped.current = true
        setHydrating(false)
      })
  }, [login, logout, setHydrating, token])

  return null
}
