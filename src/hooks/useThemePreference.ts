import { useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'yearn-theme'
const THEME_CHANGE_EVENT = 'yearn-theme-change'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

export type ThemePreference = 'light' | 'dark' | 'soft-dark'

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY)
  if (storedValue === 'light' || storedValue === 'dark' || storedValue === 'soft-dark') {
    return storedValue
  }

  // Backward compatibility: Check old storage key
  const oldStoredValue = window.localStorage.getItem('isDarkMode')
  if (oldStoredValue === 'true') {
    return 'dark'
  }
  if (oldStoredValue === 'false') {
    return 'light'
  }

  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleChange = (): void => {
    callback()
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY)
  window.addEventListener(THEME_CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleChange)
  mediaQuery.addEventListener('change', handleChange)

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleChange)
    mediaQuery.removeEventListener('change', handleChange)
  }
}

function applyThemeAttribute(theme: ThemePreference): void {
  if (typeof window === 'undefined') {
    return
  }
  document.documentElement.setAttribute('data-theme', theme)
}

export function useThemePreference(): ThemePreference {
  const theme = useSyncExternalStore(subscribe, readThemePreference, () => 'light' as ThemePreference)

  useEffect(() => {
    applyThemeAttribute(theme)
  }, [theme])

  return theme
}

export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, preference)
  applyThemeAttribute(preference)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function toggleThemePreference(): void {
  if (typeof window === 'undefined') {
    return
  }
  const current = readThemePreference()
  const next = current === 'light' ? 'dark' : current === 'dark' ? 'soft-dark' : 'light'
  setThemePreference(next)
}
