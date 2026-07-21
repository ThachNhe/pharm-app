import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { User } from '@/types/common.types'

interface AuthState {
  // State
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  setHydrating: (isHydrating: boolean) => void
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (partial: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      // Access token is intentionally kept in memory only.
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrating: true,

      // Actions
      setUser: (user) => set({ user }, false, 'auth/setUser'),

      setToken: (token) => set({ token }, false, 'auth/setToken'),

      setHydrating: (isHydrating) =>
        set({ isHydrating }, false, 'auth/setHydrating'),

      login: (user, token) =>
        set(
          { user, token, isAuthenticated: true, isHydrating: false },
          false,
          'auth/login',
        ),

      logout: () =>
        set(
          {
            user: null,
            token: null,
            isAuthenticated: false,
            isHydrating: false,
          },
          false,
          'auth/logout',
        ),

      updateUser: (partial) =>
        set(
          (state) => ({
            user: state.user ? { ...state.user, ...partial } : null,
          }),
          false,
          'auth/updateUser',
        ),
    }),
    { name: 'AuthStore' },
  ),
)
