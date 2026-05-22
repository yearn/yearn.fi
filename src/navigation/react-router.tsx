'use client'

import NextLink from 'next/link'
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { NavigationContext, type TNavigateOptions, type TNavigationContext } from './context'
import { resolveLinkTarget } from './url'

type TUrlSearchParamsInit = ConstructorParameters<typeof URLSearchParams>[0]

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
  children?: ReactNode
  preventScrollReset?: boolean
  reloadDocument?: boolean
  replace?: boolean
  state?: unknown
}

type TLocation = {
  pathname: string
  search: string
  hash: string
  state: unknown
  key: string
}

type TNavigateFunction = (to: string | number, options?: TNavigateOptions) => void

function parseEntry(entry: string): Pick<TNavigationContext, 'pathname' | 'search' | 'hash'> {
  const url = new URL(entry, 'https://yearn.fi')
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash
  }
}

function getBrowserNavigationContext(): TNavigationContext {
  const location = typeof window === 'undefined' ? parseEntry('/') : window.location

  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    params: {},
    push: (href) => window.history.pushState(null, '', href),
    replace: (href) => window.history.replaceState(null, '', href),
    go: (delta) => window.history.go(delta)
  }
}

export function MemoryRouter({
  children,
  initialEntries = ['/']
}: {
  children: ReactNode
  initialEntries?: string[]
}): ReactElement {
  const [entry, setEntry] = useState(initialEntries[0] || '/')

  const value = useMemo<TNavigationContext>(() => {
    const parsedEntry = parseEntry(entry)
    return {
      ...parsedEntry,
      params: {},
      push: (href) => setEntry(href),
      replace: (href) => setEntry(href),
      go: () => undefined
    }
  }, [entry])

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function BrowserRouter({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}

export function Link(props: LinkProps): ReactElement {
  const { to, children, preventScrollReset, reloadDocument, replace, state, ...anchorProps } = props
  const { href, isExternal } = resolveLinkTarget(to || '')

  if (isExternal || reloadDocument) {
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    )
  }

  return (
    <NextLink href={href} replace={replace} scroll={preventScrollReset ? false : undefined} {...anchorProps}>
      {children}
    </NextLink>
  )
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }): null {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, replace, to])

  return null
}

export function useLocation(): TLocation {
  const navigation = useContext(NavigationContext) ?? getBrowserNavigationContext()

  return useMemo(
    () => ({
      pathname: navigation.pathname,
      search: navigation.search,
      hash: navigation.hash,
      state: null,
      key: `${navigation.pathname}${navigation.search}${navigation.hash}`
    }),
    [navigation.hash, navigation.pathname, navigation.search]
  )
}

export function useNavigate(): TNavigateFunction {
  const navigation = useContext(NavigationContext) ?? getBrowserNavigationContext()

  return useCallback<TNavigateFunction>(
    (to, options) => {
      if (typeof to === 'number') {
        navigation.go(to)
        return
      }

      if (options?.replace) {
        navigation.replace(to, options)
        return
      }

      navigation.push(to, options)
    },
    [navigation]
  )
}

export function useParams<
  TParams extends Record<string, string | undefined> = Record<string, string | undefined>
>(): TParams {
  const navigation = useContext(NavigationContext) ?? getBrowserNavigationContext()
  return navigation.params as TParams
}

export function useSearchParams(): [
  URLSearchParams,
  (nextInit: TUrlSearchParamsInit, options?: TNavigateOptions) => void
] {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  const setSearchParams = useCallback(
    (nextInit: TUrlSearchParamsInit, options?: TNavigateOptions): void => {
      const nextSearchParams = new URLSearchParams(nextInit)
      const search = nextSearchParams.toString()
      navigate(`${location.pathname}${search ? `?${search}` : ''}`, options)
    },
    [location.pathname, navigate]
  )

  return [searchParams, setSearchParams]
}
