import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User } from '@/types/common.types'

interface AuthState {
  // State
  user: User | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (partial: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        token: null,
        isAuthenticated: false,

        // Actions
        setUser: (user) => set({ user }, false, 'auth/setUser'),

        setToken: (token) => set({ token }, false, 'auth/setToken'),

        login: (user, token) =>
          set({ user, token, isAuthenticated: true }, false, 'auth/login'),

        logout: () =>
          set(
            { user: null, token: null, isAuthenticated: false },
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
      {
        name: 'auth-storage',
        // Chỉ persist những field cần thiết
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
)
