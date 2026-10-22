'use client'

import { setThemePreference, useThemePreference as useSharedThemePreference } from '@yearn/site-header/theme'

export type TTheme = 'light' | 'dark'

export function useThemePreference() {
  const preference = useSharedThemePreference()
  const theme: TTheme = preference === 'light' ? 'light' : 'dark'
  const changeTheme = (nextTheme: TTheme) =>
    setThemePreference(nextTheme === 'light' ? 'light' : preference === 'light' ? 'soft-dark' : preference)
  return [theme, changeTheme] as const
}
