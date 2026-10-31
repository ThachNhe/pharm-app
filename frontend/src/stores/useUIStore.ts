import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type Palette = 'green' | 'blue'

interface UIState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  palette: Palette
  setPalette: (palette: Palette) => void

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
        theme: 'light',
        setTheme: (theme) => set({ theme }, false, 'ui/setTheme'),
        palette: 'green',
        setPalette: (palette) => set({ palette }, false, 'ui/setPalette'),

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
        // v0 stored an unused 'system' default; start everyone on light until they choose.
        version: 1,
        migrate: (persisted) => {
          const saved = typeof persisted === 'object' && persisted !== null ? persisted : {}
          const palette: Palette = 'palette' in saved && saved.palette === 'blue' ? 'blue' : 'green'
          const isSidebarCollapsed = 'isSidebarCollapsed' in saved && saved.isSidebarCollapsed === true
          return { theme: 'light' as const, palette, isSidebarCollapsed }
        },
        // Chỉ persist theme, màu chủ đạo và sidebar collapse state
        partialize: (state) => ({
          theme: state.theme,
          palette: state.palette,
          isSidebarCollapsed: state.isSidebarCollapsed,
        }),
      },
    ),
    { name: 'UIStore' },
  ),
)
