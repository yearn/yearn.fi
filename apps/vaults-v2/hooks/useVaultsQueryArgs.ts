import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import type { TDict, TSortDirection } from '@lib/types'
import { useMountEffect } from '@react-hookz/web'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { ALL_VAULTSV3_CATEGORIES_KEYS, ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

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
function useQueryArguments(props: {
  defaultTypes?: string[]
  defaultCategories?: string[]
  defaultSortBy?: TPossibleSortBy
  defaultPathname?: string
}): TQueryArgs {
  const allChains = useSupportedChains().map((chain): number => chain.id)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState<string | null>(null)
  const [types, setTypes] = useState<string[] | null>(props.defaultTypes || [])
  const [categories, setCategories] = useState<string[] | null>(props.defaultCategories || [])
  const [chains, setChains] = useState<number[] | null>(allChains || [])
  const [sortDirection, setSortDirection] = useState<string | null>(null)

  const defaultSortBy = props.defaultSortBy || 'deposited'
  const [sortBy, setSortBy] = useState<string | null>(defaultSortBy)

  const pathname = location.pathname

  const updateSearchParams = useCallback(
    (queryArgs: TDict<string | string[] | undefined>): void => {
      const newSearchParams = new URLSearchParams()
      Object.entries(queryArgs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            newSearchParams.set(key, value.join('_'))
          } else {
            newSearchParams.set(key, value as string)
          }
        }
      })
      navigate(`${pathname}?${newSearchParams.toString()}`, { replace: true })
    },
    [navigate, pathname]
  )

  const handleQuery = useCallback(
    (_searchParams: URLSearchParams): void => {
      if (_searchParams.has('search')) {
        const _search = _searchParams.get('search')
        if (_search === null) {
          return
        }
        setSearch(_search)
      }

      if (_searchParams.has('types')) {
        const typesParam = _searchParams.get('types')
        const typesParamArray = typesParam?.split('_') || []
        if (typesParamArray.length === 0) {
          setTypes(props.defaultTypes || [])
          return
        }
        if (typesParamArray.length === props.defaultTypes?.length) {
          const isEqual = typesParamArray.every((c): boolean => Boolean(props.defaultTypes?.includes(c)))
          if (isEqual) {
            setTypes(props.defaultTypes)
            return
          }
        }
        if (typesParamArray[0] === 'none') {
          setTypes([])
          return
        }
        setTypes(typesParamArray)
      } else {
        setTypes(props.defaultTypes || [])
      }

      if (_searchParams.has('categories')) {
        const categoriesParam = _searchParams.get('categories')
        const categoriesParamArray = categoriesParam?.split('_') || []
        if (categoriesParamArray.length === 0) {
          setCategories(props.defaultCategories || [])
          return
        }
        if (categoriesParamArray.length === props.defaultCategories?.length) {
          const isEqual = categoriesParamArray.every((c): boolean => Boolean(props.defaultCategories?.includes(c)))
          if (isEqual) {
            setCategories(props.defaultCategories)
            return
          }
        }
        if (categoriesParamArray[0] === 'none') {
          setCategories([])
          return
        }
        setCategories(categoriesParamArray)
      } else {
        setCategories(props.defaultCategories || [])
      }

      if (_searchParams.has('chains')) {
        const chainsParam = _searchParams.get('chains')
        const chainsParamArray = chainsParam?.split('_') || []
        if (chainsParamArray.length === 0) {
          setChains(allChains)
          return
        }
        if (chainsParamArray.length === allChains.length) {
          const isEqual = chainsParamArray.every((c): boolean => allChains.includes(Number(c)))
          if (isEqual) {
            setChains(allChains)
            return
          }
        }
        if (chainsParamArray[0] === '0') {
          setChains([])
          return
        }
        setChains(chainsParamArray.map((chain): number => Number(chain)))
      } else {
        setChains(allChains)
      }

      if (_searchParams.has('sortDirection')) {
        const _sortDirection = _searchParams.get('sortDirection')
        if (_sortDirection === null) {
          return
        }
        setSortDirection(_sortDirection)
      }

      if (_searchParams.has('sortBy')) {
        const _sortBy = _searchParams.get('sortBy')
        if (_sortBy === null) {
          return
        }
        setSortBy(_sortBy)
      }
    },
    [props.defaultTypes, props.defaultCategories, allChains]
  )

  useMountEffect((): void => {
    const currentPage = new URL(window.location.href)
    handleQuery(new URLSearchParams(currentPage.search))
  })

  // Track if we've already processed the current search params to avoid loops
  const lastProcessedSearch = useRef<string>('')
  const searchString = searchParams.toString()

  useEffect((): void => {
    // Only process if search params actually changed
    if (lastProcessedSearch.current !== searchString) {
      lastProcessedSearch.current = searchString
      if (!props.defaultPathname || props.defaultPathname === pathname) {
        handleQuery(searchParams as URLSearchParams)
      }
    }
  }, [searchString, props.defaultPathname, pathname, handleQuery, searchParams])

  return {
    search,
    types: (types || []) as string[],
    categories: (categories || []) as string[],
    chains: (chains || []) as number[],
    sortDirection: (sortDirection || 'desc') as TSortDirection,
    sortBy: (sortBy || 'featuringScore') as TPossibleSortBy,
    onSearch: (value): void => {
      setSearch(value)
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
      setTypes(value)
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
      setCategories(value)
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
      setChains(value)
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
      setSortDirection(value)
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
      setSortBy(value)
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
      setSearch(null)
      setTypes(props.defaultTypes || [])
      setCategories(props.defaultCategories || [])
      setChains(allChains || [])
      setSortDirection('desc')
      setSortBy(defaultSortBy)

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
      const isV3 = props.defaultPathname === '/v3'
      setTypes(isV3 ? ALL_VAULTSV3_KINDS_KEYS : props.defaultTypes || [])
      setCategories(isV3 ? ALL_VAULTSV3_CATEGORIES_KEYS : props.defaultCategories || [])
      setChains(allChains || [])
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
