import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { useSupportedChains } from '@shared/hooks/useSupportedChains'
import type { TDict, TSortDirection } from '@shared/types'
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

  const getQueryArgsExcluding = useCallback(
    (excludeKeys: string[]): TDict<string | string[] | undefined> => {
      const queryArgs: TDict<string | string[] | undefined> = {}
      searchParams.forEach((val, key) => {
        if (!excludeKeys.includes(key)) {
          queryArgs[key] = val
        }
      })
      return queryArgs
    },
    [searchParams]
  )

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

  const createStringHandler = useCallback(
    (key: string) =>
      (value: string): void => {
        const queryArgs = getQueryArgsExcluding([key])
        if (value === '') {
          delete queryArgs[key]
        } else {
          queryArgs[key] = value
        }
        updateSearchParams(queryArgs)
      },
    [getQueryArgsExcluding, updateSearchParams]
  )

  const createArrayHandler = useCallback(
    <T extends string | number>(key: string, defaults: T[] | undefined, emptyValue: string) =>
      (value: T[] | null): void => {
        const queryArgs = getQueryArgsExcluding([key])
        if (value === null || value.length === 0) {
          queryArgs[key] = emptyValue
        } else if (defaults && value.length === defaults.length) {
          const isEqual = value.every((v): boolean => (defaults as T[]).includes(v))
          if (isEqual) {
            delete queryArgs[key]
          } else {
            queryArgs[key] = value.join('_')
          }
        } else {
          queryArgs[key] = value.join('_')
        }
        updateSearchParams(queryArgs)
      },
    [getQueryArgsExcluding, updateSearchParams]
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

  const onSearch = useMemo(() => createStringHandler('search'), [createStringHandler])
  const onChangeSortDirection = useMemo(() => createStringHandler('sortDirection'), [createStringHandler])
  const onChangeSortBy = useMemo(() => createStringHandler('sortBy'), [createStringHandler])
  const onChangeTypes = useMemo(
    () => createArrayHandler('types', props.defaultTypes, 'none'),
    [createArrayHandler, props.defaultTypes]
  )
  const onChangeCategories = useMemo(
    () => createArrayHandler('categories', props.defaultCategories, 'none'),
    [createArrayHandler, props.defaultCategories]
  )
  const onChangeChains = useMemo(() => createArrayHandler('chains', allChains, '0'), [createArrayHandler, allChains])

  const onReset = useCallback((): void => {
    const queryArgs = getQueryArgsExcluding(['search', 'types', 'categories', 'chains', 'sortDirection', 'sortBy'])
    updateSearchParams(queryArgs)
  }, [getQueryArgsExcluding, updateSearchParams])

  const onResetMultiSelect = useCallback((): void => {
    const queryArgs = getQueryArgsExcluding(['types', 'categories', 'chains'])
    updateSearchParams(queryArgs)
  }, [getQueryArgsExcluding, updateSearchParams])

  return {
    search,
    types: types as string[],
    categories: categories as string[],
    chains: chains as number[],
    sortDirection,
    sortBy,
    onSearch,
    onChangeTypes,
    onChangeCategories,
    onChangeChains,
    onChangeSortDirection: onChangeSortDirection as TQueryArgs['onChangeSortDirection'],
    onChangeSortBy: onChangeSortBy as TQueryArgs['onChangeSortBy'],
    onReset,
    onResetMultiSelect
  }
}

export { useQueryArguments }
export type { TQueryArgs }
