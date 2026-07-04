import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface Toast {
  id: string
  title: string
  description?: string
  type: 'success' | 'error' | 'warning' | 'info'
}

interface UIState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Sidebar
  isSidebarOpen: boolean
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapse: () => void

  // Loading (global full-screen loader)
  isGlobalLoading: boolean
  setGlobalLoading: (loading: boolean) => void

  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Theme
        theme: 'system',
        setTheme: (theme) => set({ theme }, false, 'ui/setTheme'),

        // Sidebar
        isSidebarOpen: true,
        isSidebarCollapsed: false,
        toggleSidebar: () =>
          set(
            (state) => ({ isSidebarOpen: !state.isSidebarOpen }),
            false,
            'ui/toggleSidebar',
          ),
        setSidebarOpen: (open) =>
          set({ isSidebarOpen: open }, false, 'ui/setSidebarOpen'),
        toggleSidebarCollapse: () =>
          set(
            (state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }),
            false,
            'ui/toggleSidebarCollapse',
          ),

        // Global Loading
        isGlobalLoading: false,
        setGlobalLoading: (loading) =>
          set({ isGlobalLoading: loading }, false, 'ui/setGlobalLoading'),

        // Toasts
        toasts: [],
        addToast: (toast) =>
          set(
            (state) => ({
              toasts: [
                ...state.toasts,
                { ...toast, id: crypto.randomUUID() },
              ],
            }),
            false,
            'ui/addToast',
          ),
        removeToast: (id) =>
          set(
            (state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }),
            false,
            'ui/removeToast',
          ),
        clearToasts: () => set({ toasts: [] }, false, 'ui/clearToasts'),
      }),
      {
        name: 'ui-storage',
        // Chỉ persist theme và sidebar collapse state
        partialize: (state) => ({
          theme: state.theme,
          isSidebarCollapsed: state.isSidebarCollapsed,
        }),
      },
    ),
    { name: 'UIStore' },
  ),
)
