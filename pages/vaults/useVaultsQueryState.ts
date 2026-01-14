import type { TPossibleSortBy } from '@vaults/shared/hooks/useSortVaults'
import { useQueryArguments } from '@vaults/shared/hooks/useVaultsQueryArgs'
import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { readBooleanParam } from './constants'
import type { TVaultType } from './vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam, sanitizeChainsParam } from './vaultTypeUtils'

type TVaultsQueryStateConfig = {
  defaultTypes?: string[]
  defaultCategories?: string[]
  defaultSortBy?: TPossibleSortBy
  defaultPathname?: string
  resetTypes?: string[]
  resetCategories?: string[]
}

type TVaultsQueryState = {
  vaultType: TVaultType
  hasTypesParam: boolean
  search: string | null | undefined
  types: string[] | null
  categories: string[] | null
  chains: number[] | null
  aggressiveness: string[] | null
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeAggressiveness: (value: string[] | null) => void
  onChangeShowLegacyVaults: (value: boolean) => void
  onChangeShowHiddenVaults: (value: boolean) => void
  onChangeShowStrategies: (value: boolean) => void
  onChangeVaultType: (nextType: TVaultType) => void
  onResetMultiSelect: () => void
  onResetExtraFilters: () => void
}

export function useVaultsQueryState(config: TVaultsQueryStateConfig): TVaultsQueryState {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryArgs = useQueryArguments(config)
  const vaultType = useMemo(() => normalizeVaultTypeParam(searchParams.get('type')), [searchParams])
  const hasTypesParam = searchParams.has('types')

  useEffect(() => {
    if (!searchParams.has('sortDirection') && !searchParams.has('sortBy')) {
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('sortDirection')
    nextParams.delete('sortBy')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const readStringList = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key)
      if (!raw || raw === 'none') return []
      return raw
        .split('_')
        .map((value) => value.trim())
        .filter(Boolean)
    },
    [searchParams]
  )

  const aggressiveness = readStringList('aggr')
  const showHiddenVaults = readBooleanParam(searchParams, 'showHidden')
  const showStrategies = readBooleanParam(searchParams, 'showStrategies')
  const showLegacyParam = searchParams.get('showLegacy')
  const showLegacyFromParam = showLegacyParam !== null ? readBooleanParam(searchParams, 'showLegacy') : false
  const legacyFallback = Boolean(queryArgs.types?.includes('legacy'))
  const showLegacyVaults = showLegacyParam !== null ? showLegacyFromParam : legacyFallback

  const updateParam = useCallback(
    (key: string, value: string[] | null): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (!value || value.length === 0) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value.join('_'))
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const onChangeAggressiveness = useCallback(
    (value: string[] | null): void => {
      updateParam('aggr', value)
    },
    [updateParam]
  )

  const onChangeShowLegacyVaults = useCallback(
    (value: boolean): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showLegacy', '1')
      } else {
        nextParams.delete('showLegacy')
        const rawTypes = nextParams.get('types')
        if (rawTypes) {
          const nextTypes = rawTypes
            .split('_')
            .map((type) => type.trim())
            .filter((type) => type && type !== 'legacy' && type !== 'factory')
          if (nextTypes.length === 0) {
            nextParams.delete('types')
          } else {
            nextParams.set('types', nextTypes.join('_'))
          }
        }
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const onChangeShowHiddenVaults = useCallback(
    (value: boolean): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showHidden', '1')
      } else {
        nextParams.delete('showHidden')
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const onChangeShowStrategies = useCallback(
    (value: boolean): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showStrategies', '1')
      } else {
        nextParams.delete('showStrategies')
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const onChangeVaultType = useCallback(
    (nextType: TVaultType): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (nextType === 'all') {
        nextParams.delete('type')
      } else if (nextType === 'v3') {
        nextParams.set('type', 'single')
      } else {
        nextParams.set('type', 'lp')
      }
      sanitizeChainsParam(nextParams, getSupportedChainsForVaultType(nextType))
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const onResetExtraFilters = useCallback((): void => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('aggr')
    nextParams.delete('showLegacy')
    nextParams.delete('showHidden')
    nextParams.delete('showStrategies')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  return {
    vaultType,
    hasTypesParam,
    search: queryArgs.search,
    types: queryArgs.types,
    categories: queryArgs.categories,
    chains: queryArgs.chains,
    aggressiveness,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    onSearch: queryArgs.onSearch,
    onChangeTypes: queryArgs.onChangeTypes,
    onChangeCategories: queryArgs.onChangeCategories,
    onChangeChains: queryArgs.onChangeChains,
    onChangeAggressiveness,
    onChangeShowLegacyVaults,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onChangeVaultType,
    onResetMultiSelect: queryArgs.onResetMultiSelect,
    onResetExtraFilters
  }
}
