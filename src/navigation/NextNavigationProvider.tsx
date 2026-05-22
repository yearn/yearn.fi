'use client'

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'
import { useMemo } from 'react'
import { NavigationContext, type TNavigationContext, type TRouteParams } from './context'

export function NextNavigationProvider({ children }: { children: ReactNode }): ReactElement {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const params = useParams()
  const search = searchParams.toString()

  const value = useMemo<TNavigationContext>(() => {
    const normalizedParams = Object.entries(params).reduce<TRouteParams>((nextParams, [key, value]) => {
      nextParams[key] = value
      return nextParams
    }, {})

    return {
      pathname,
      search: search ? `?${search}` : '',
      hash: typeof window === 'undefined' ? '' : window.location.hash,
      params: normalizedParams,
      push: (href, options) => router.push(href, { scroll: options?.scroll }),
      replace: (href, options) => router.replace(href, { scroll: options?.scroll }),
      go: (delta) => window.history.go(delta)
    }
  }, [params, pathname, router, search])

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}
