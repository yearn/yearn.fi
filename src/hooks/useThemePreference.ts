import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'isDarkMode'
const THEME_CHANGE_EVENT = 'yearn-theme-change'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

export type ThemePreference = 'light' | 'dark'

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY)
  if (storedValue === 'true') {
    return 'dark'
  }
  if (storedValue === 'false') {
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

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'light')
}

export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, preference === 'dark' ? 'true' : 'false')
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function toggleThemePreference(): void {
  if (typeof window === 'undefined') {
    return
  }
  const current = readThemePreference()
  setThemePreference(current === 'dark' ? 'light' : 'dark')
}
