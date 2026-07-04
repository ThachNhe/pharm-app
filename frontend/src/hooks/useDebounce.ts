import { useState, useEffect } from 'react'

/**
 * Delays updating a value until after a specified delay.
 * Useful for search inputs to avoid firing API calls on every keystroke.
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 500)
 * useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch])
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
