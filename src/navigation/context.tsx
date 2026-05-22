'use client'

import { createContext } from 'react'

export type TRouteParams = Record<string, string | string[] | undefined>

export type TNavigateOptions = {
  replace?: boolean
  scroll?: boolean
  state?: unknown
}

export type TNavigationContext = {
  pathname: string
  search: string
  hash: string
  params: TRouteParams
  push: (href: string, options?: TNavigateOptions) => void
  replace: (href: string, options?: TNavigateOptions) => void
  go: (delta: number) => void
}

export const NavigationContext = createContext<TNavigationContext | null>(null)
