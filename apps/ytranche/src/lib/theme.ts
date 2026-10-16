'use client'

import { useSyncExternalStore } from 'react'

export type TTheme = 'light' | 'dark'
const THEME_EVENT = 'ytranche-theme-change'
const subscribe = (onChange: () => void) => {
  window.addEventListener(THEME_EVENT, onChange)
  return () => window.removeEventListener(THEME_EVENT, onChange)
}
const getSnapshot = (): TTheme => (document.documentElement.dataset.ytrancheTheme === 'dark' ? 'dark' : 'light')
const getServerSnapshot = (): TTheme => 'light'

export function useThemePreference() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const changeTheme = (nextTheme: TTheme) => {
    document.documentElement.dataset.ytrancheTheme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    try {
      window.localStorage.setItem('ytranche-theme', nextTheme)
    } catch {
      // Keep theme switching available when browser storage is disabled.
    }
    window.dispatchEvent(new Event(THEME_EVENT))
  }
  return [theme, changeTheme] as const
}
