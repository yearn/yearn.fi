import { useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'yearn-theme'
const THEME_CHANGE_EVENT = 'yearn-theme-change'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

export type ThemePreference = 'light' | 'soft-dark' | 'blue-dark' | 'midnight'

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY)
  if (
    storedValue === 'light' ||
    storedValue === 'soft-dark' ||
    storedValue === 'blue-dark' ||
    storedValue === 'midnight'
  ) {
    return storedValue
  }
  if (storedValue === 'dark') {
    window.localStorage.setItem(STORAGE_KEY, 'midnight')
    return 'midnight'
  }

  // Backward compatibility: Check old storage key
  const oldStoredValue = window.localStorage.getItem('isDarkMode')
  if (oldStoredValue === 'true') {
    window.localStorage.setItem(STORAGE_KEY, 'soft-dark')
    return 'soft-dark'
  }
  if (oldStoredValue === 'false') {
    window.localStorage.setItem(STORAGE_KEY, 'light')
    return 'light'
  }

  return window.matchMedia(MEDIA_QUERY).matches ? 'soft-dark' : 'light'
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
  const order: ThemePreference[] = ['light', 'soft-dark', 'blue-dark', 'midnight']
  const currentIndex = order.indexOf(current)
  const next = order[(currentIndex + 1) % order.length] ?? 'light'
  setThemePreference(next)
}
