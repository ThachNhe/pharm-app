import { useState, useEffect } from 'react'

/**
 * Tracks whether a CSS media query matches.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)')
 * const isDark = useMediaQuery('(prefers-color-scheme: dark)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // SSR safe
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

// ─── Preset breakpoint hooks (Tailwind defaults) ───────────────────────────

export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () =>
  useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useIsDarkMode = () =>
  useMediaQuery('(prefers-color-scheme: dark)')
