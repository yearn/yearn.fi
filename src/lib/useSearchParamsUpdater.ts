'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type TSearchParamsInit =
  | URLSearchParams
  | string
  | string[][]
  | Record<string, string | string[] | undefined>

type TSetSearchParamsOptions = {
  replace?: boolean
  scroll?: boolean
}

type TSetSearchParams =
  | TSearchParamsInit
  | ((previous: URLSearchParams) => TSearchParamsInit)

function toURLSearchParams(init: TSearchParamsInit): URLSearchParams {
  if (init instanceof URLSearchParams) {
    return new URLSearchParams(init.toString())
  }

  if (typeof init === 'string' || Array.isArray(init)) {
    return new URLSearchParams(init)
  }

  const nextParams = new URLSearchParams()
  Object.entries(init).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    if (Array.isArray(value)) {
      nextParams.set(key, value.join('_'))
      return
    }

    nextParams.set(key, value)
  })
  return nextParams
}

export function useSearchParamsUpdater(): readonly [
  ReturnType<typeof useSearchParams>,
  (nextInit: TSetSearchParams, options?: TSetSearchParamsOptions) => void
] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSearchParams = useCallback(
    (nextInit: TSetSearchParams, options?: TSetSearchParamsOptions) => {
      const previous = new URLSearchParams(searchParams.toString())
      const resolvedInit = typeof nextInit === 'function' ? nextInit(previous) : nextInit
      const nextParams = toURLSearchParams(resolvedInit)
      const query = nextParams.toString()
      const href = query ? `${pathname}?${query}` : pathname

      if (options?.replace ?? true) {
        router.replace(href, { scroll: options?.scroll })
        return
      }

      router.push(href, { scroll: options?.scroll })
    },
    [pathname, router, searchParams]
  )

  return [searchParams, setSearchParams] as const
}
