import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import type { TDict, TSortDirection } from '@lib/types'
import type { TPossibleSortBy } from '@vaults-shared/hooks/useSortVaults'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

type TQueryArgs = {
  search: string | null | undefined
  types: string[] | null
  categories: string[] | null
  chains: number[] | null
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onReset: () => void
  onResetMultiSelect: () => void
}

type TUseQueryArgumentsProps = {
  defaultTypes?: string[]
  defaultCategories?: string[]
  defaultSortBy?: TPossibleSortBy
  defaultPathname?: string
  resetTypes?: string[]
  resetCategories?: string[]
}

function useQueryArguments(props: TUseQueryArgumentsProps): TQueryArgs {
  const allChains = useSupportedChains().map((chain): number => chain.id)
  const [searchParams, setSearchParams] = useSearchParams()

  const defaultSortBy = props.defaultSortBy || 'featuringScore'
  const updateSearchParams = useCallback(
    (queryArgs: TDict<string | string[] | undefined>): void => {
      const newSearchParams = new URLSearchParams()
      Object.entries(queryArgs).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return
        }
        if (Array.isArray(value)) {
          newSearchParams.set(key, value.join('_'))
        } else {
          newSearchParams.set(key, value as string)
        }
      })
      setSearchParams(newSearchParams, { replace: true })
    },
    [setSearchParams]
  )

  const parseStringList = useCallback(
    (key: string, defaults?: string[]): string[] => {
      if (!searchParams.has(key)) {
        return defaults || []
      }
      const raw = searchParams.get(key)
      if (!raw || raw === 'none') {
        return []
      }
      const values = raw
        .split('_')
        .map((value) => value.trim())
        .filter(Boolean)
      if (values.length === 0) {
        return defaults || []
      }
      if (defaults && values.length === defaults.length) {
        const isEqual = values.every((value): boolean => defaults.includes(value))
        if (isEqual) {
          return defaults
        }
      }
      return values
    },
    [searchParams]
  )

  const parseNumberList = useCallback(
    (key: string): number[] => {
      if (!searchParams.has(key)) {
        return []
      }
      const raw = searchParams.get(key)
      if (!raw || raw === '0') {
        return []
      }
      const values = raw
        .split('_')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
      if (values.length === 0) {
        return []
      }
      if (values.length === allChains.length) {
        const isEqual = values.every((value) => allChains.includes(value))
        if (isEqual) {
          return allChains
        }
      }
      return values
    },
    [searchParams, allChains]
  )

  const search = searchParams.get('search')
  const types = useMemo(() => parseStringList('types', props.defaultTypes), [parseStringList, props.defaultTypes])
  const categories = useMemo(
    () => parseStringList('categories', props.defaultCategories),
    [parseStringList, props.defaultCategories]
  )
  const chains = useMemo(() => parseNumberList('chains'), [parseNumberList])
  const sortDirection = (searchParams.get('sortDirection') || 'desc') as TSortDirection
  const sortBy = (searchParams.get('sortBy') || defaultSortBy) as TPossibleSortBy

  return {
    search,
    types: types as string[],
    categories: categories as string[],
    chains: chains as number[],
    sortDirection,
    sortBy,
    onSearch: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'search') {
          queryArgs[key] = val
        }
      })

      if (value === '') {
        delete queryArgs.search
      } else {
        queryArgs.search = value
      }

      updateSearchParams(queryArgs)
    },
    onChangeTypes: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'types') {
          queryArgs[key] = val
        }
      })

      if (value === null || value.length === 0) {
        queryArgs.types = 'none'
      } else if (value.length === props.defaultTypes?.length) {
        const isEqual = value.every((category): boolean => Boolean(props.defaultTypes?.includes(category)))
        if (isEqual) {
          delete queryArgs.types
        } else {
          queryArgs.types = value.join('_')
        }
      } else {
        queryArgs.types = value.join('_')
      }

      updateSearchParams(queryArgs)
    },
    onChangeCategories: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'categories') {
          queryArgs[key] = val
        }
      })

      if (value === null || value.length === 0) {
        queryArgs.categories = 'none'
      } else if (value.length === props.defaultCategories?.length) {
        const isEqual = value.every((category): boolean => Boolean(props.defaultCategories?.includes(category)))
        if (isEqual) {
          delete queryArgs.categories
        } else {
          queryArgs.categories = value.join('_')
        }
      } else {
        queryArgs.categories = value.join('_')
      }

      updateSearchParams(queryArgs)
    },
    onChangeChains: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'chains') {
          queryArgs[key] = val
        }
      })

      if (value === null || value.length === 0) {
        queryArgs.chains = '0'
      } else if (value.length === allChains.length) {
        const isEqual = value.every((chain): boolean => allChains.includes(chain))
        if (isEqual) {
          delete queryArgs.chains
        } else {
          queryArgs.chains = value.join('_')
        }
      } else {
        queryArgs.chains = value.join('_')
      }

      updateSearchParams(queryArgs)
    },
    onChangeSortDirection: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'sortDirection') {
          queryArgs[key] = val
        }
      })

      if (value === '') {
        delete queryArgs.sortDirection
      } else {
        queryArgs.sortDirection = value as string
      }

      updateSearchParams(queryArgs)
    },
    onChangeSortBy: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params
      searchParams.forEach((val, key) => {
        if (key !== 'sortBy') {
          queryArgs[key] = val
        }
      })

      if (value === '') {
        delete queryArgs.sortBy
      } else {
        queryArgs.sortBy = value
      }

      updateSearchParams(queryArgs)
    },
    onReset: (): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}

      // Get current search params but exclude the ones we're resetting
      searchParams.forEach((val, key) => {
        if (
          key !== 'search' &&
          key !== 'types' &&
          key !== 'categories' &&
          key !== 'chains' &&
          key !== 'sortDirection' &&
          key !== 'sortBy'
        ) {
          queryArgs[key] = val
        }
      })
      updateSearchParams(queryArgs)
    },
    onResetMultiSelect: (): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}
      searchParams.forEach((val, key) => {
        if (key !== 'types' && key !== 'categories' && key !== 'chains') {
          queryArgs[key] = val
        }
      })
      updateSearchParams(queryArgs)
    }
  }
}

export { useQueryArguments }
export type { TQueryArgs }
