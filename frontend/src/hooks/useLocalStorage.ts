import { useState, useEffect, useCallback } from 'react'

/**
 * Syncs state with localStorage. Handles JSON serialization/deserialization.
 * Falls back to initialValue if key doesn't exist or JSON parsing fails.
 *
 * @example
 * const [token, setToken, removeToken] = useLocalStorage('token', '')
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Read from localStorage on init
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      console.warn(`useLocalStorage: error reading key "${key}"`)
      return initialValue
    }
  })

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          setStoredValue(
            event.newValue ? (JSON.parse(event.newValue) as T) : initialValue,
          )
        } catch {
          console.warn(`useLocalStorage: error syncing key "${key}"`)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch {
        console.warn(`useLocalStorage: error setting key "${key}"`)
      }
    },
    [key, storedValue],
  )

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      window.localStorage.removeItem(key)
    } catch {
      console.warn(`useLocalStorage: error removing key "${key}"`)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}
