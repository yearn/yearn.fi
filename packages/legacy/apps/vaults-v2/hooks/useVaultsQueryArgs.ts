import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import type { TDict, TSortDirection } from '@lib/types'
import { useMountEffect } from '@react-hookz/web'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { ALL_VAULTSV3_CATEGORIES_KEYS, ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'

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
  const router = useRouter()
  const [search, setSearch] = useState<string | null>(null)
  const [types, setTypes] = useState<string[] | null>(props.defaultTypes || [])
  const [categories, setCategories] = useState<string[] | null>(props.defaultCategories || [])
  const [chains, setChains] = useState<number[] | null>(allChains || [])
  const [sortDirection, setSortDirection] = useState<string | null>(null)

  const defaultSortBy = props.defaultSortBy || 'deposited'
  const [sortBy, setSortBy] = useState<string | null>(defaultSortBy)

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
      for (const key in router.query) {
        if (key !== 'search') {
          queryArgs[key] = router.query[key]
        }
      }

      if (value === '') {
        queryArgs.search = undefined
        delete queryArgs.search
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      queryArgs.search = value
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onChangeTypes: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'types') {
          queryArgs[key] = router.query[key]
        }
      }

      setTypes(value)
      if (value === null) {
        queryArgs.types = 'none'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === 0) {
        queryArgs.types = 'none'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === props.defaultTypes?.length) {
        const isEqual = value.every((category): boolean => Boolean(props.defaultTypes?.includes(category)))
        if (isEqual) {
          queryArgs.types = undefined
          delete queryArgs.types
          router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
            shallow: true
          })

          return
        }
      }
      queryArgs.types = value.join('_')
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onChangeCategories: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'categories') {
          queryArgs[key] = router.query[key]
        }
      }

      setCategories(value)
      if (value === null) {
        queryArgs.categories = 'none'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === 0) {
        queryArgs.categories = 'none'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === props.defaultCategories?.length) {
        const isEqual = value.every((category): boolean => Boolean(props.defaultCategories?.includes(category)))
        if (isEqual) {
          queryArgs.categories = undefined
          delete queryArgs.categories
          router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
            shallow: true
          })
          return
        }
      }
      queryArgs.categories = value.join('_')
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onChangeChains: (value): void => {
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'chains') {
          queryArgs[key] = router.query[key]
        }
      }
      setChains(value)
      if (value === null) {
        queryArgs.chains = '0'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === 0) {
        queryArgs.chains = '0'
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      if (value.length === allChains.length) {
        const isEqual = value.every((chain): boolean => allChains.includes(chain))
        if (isEqual) {
          queryArgs.chains = undefined
          delete queryArgs.chains
          router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
            shallow: true
          })
          return
        }
      }
      queryArgs.chains = value.join('_')
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onChangeSortDirection: (value): void => {
      setSortDirection(value)
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'sortDirection') {
          queryArgs[key] = router.query[key]
        }
      }

      if (value === '') {
        queryArgs.sortDirection = undefined
        delete queryArgs.sortDirection
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      queryArgs.sortDirection = value as string
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onChangeSortBy: (value): void => {
      setSortBy(value)
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'sortBy') {
          queryArgs[key] = router.query[key]
        }
      }

      if (value === '') {
        queryArgs.sortBy = undefined
        delete queryArgs.sortBy
        router.replace({ pathname: router.pathname, query: queryArgs }, undefined, {
          shallow: true
        })
        return
      }
      queryArgs.sortBy = value
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onReset: (): void => {
      setSearch(null)
      setTypes(props.defaultTypes || [])
      setCategories(props.defaultCategories || [])
      setChains(allChains || [])
      setSortDirection('desc')
      setSortBy(defaultSortBy)
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (
          key !== 'search' &&
          key !== 'types' &&
          key !== 'categories' &&
          key !== 'chains' &&
          key !== 'sortDirection' &&
          key !== 'sortBy'
        ) {
          queryArgs[key] = router.query[key]
        }
      }
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    },
    onResetMultiSelect: (): void => {
      const isV3 = props.defaultPathname === '/v3'
      setTypes(isV3 ? ALL_VAULTSV3_KINDS_KEYS : props.defaultTypes || [])
      setCategories(isV3 ? ALL_VAULTSV3_CATEGORIES_KEYS : props.defaultCategories || [])
      setChains(allChains || [])
      const queryArgs: TDict<string | string[] | undefined> = {}
      for (const key in router.query) {
        if (key !== 'types' && key !== 'categories' && key !== 'chains') {
          queryArgs[key] = router.query[key]
        }
      }
      router.replace({ pathname: router.pathname, query: queryArgs }, undefined, { shallow: true })
    }
  }
}

export { useQueryArguments }
