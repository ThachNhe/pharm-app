import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

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
