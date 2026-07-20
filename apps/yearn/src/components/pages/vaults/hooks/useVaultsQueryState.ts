import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { DEFAULT_MIN_TVL } from '@pages/vaults/utils/constants'
import {
  areQuerySnapshotsEqual,
  areStringListsEqual,
  buildSnapshotFromParams,
  buildUrlParamsFromSnapshot,
  clearVaultQueryParams,
  DEFAULT_VAULT_QUERY_SORT_BY,
  hasVaultQueryParams,
  normalizeChainsSelection,
  normalizeMinTvl,
  normalizeUnderlyingAssetList,
  normalizeV3Types,
  parseSortDirection,
  sanitizeInactiveSortParams,
  sanitizeStringList,
  type TVaultsQueryDefaults,
  type TVaultsQuerySnapshot
} from '@pages/vaults/utils/vaultsQueryState'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam } from '@pages/vaults/utils/vaultTypeUtils'
import type { TSortDirection } from '@shared/types'
import { copyToClipboard } from '@shared/utils/helpers'
import { usePathname, useRouter } from 'next/navigation'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TVaultsQueryStateConfig = {
  defaultTypes?: string[]
  defaultCategories?: string[]
  defaultSortBy?: TPossibleSortBy
  defaultPathname?: string
  resetTypes?: string[]
  resetCategories?: string[]
  persistToStorage?: boolean
  storageKey?: string
  clearUrlAfterInit?: boolean
  shareUpdatesUrl?: boolean
  syncUrlOnChange?: boolean
  initialSnapshot?: TVaultsQuerySnapshot
}

type TVaultsQueryState = {
  vaultType: TVaultType
  hasTypesParam: boolean
  search: string | null | undefined
  types: string[] | null
  categories: string[] | null
  chains: number[] | null
  aggressiveness: string[] | null
  underlyingAssets: string[]
  minTvl: number
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeAggressiveness: (value: string[] | null) => void
  onChangeUnderlyingAssets: (value: string[] | null) => void
  onChangeMinTvl: (value: number) => void
  onChangeShowLegacyVaults: (value: boolean) => void
  onChangeShowHiddenVaults: (value: boolean) => void
  onChangeShowStrategies: (value: boolean) => void
  onChangeVaultType: (nextType: TVaultType) => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onResetMultiSelect: () => void
  onResetExtraFilters: () => void
  onShareFilters: () => void
}

function readSnapshotFromStorage(storageKey: string, defaults: TVaultsQueryDefaults): TVaultsQuerySnapshot | null {
  if (!storageKey || typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<TVaultsQuerySnapshot>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const vaultType = normalizeVaultTypeParam(typeof parsed.vaultType === 'string' ? parsed.vaultType : null)
    const types = normalizeV3Types(Array.isArray(parsed.types) ? parsed.types : null)
    const categories = sanitizeStringList(Array.isArray(parsed.categories) ? parsed.categories : null)
    const rawChains = Array.isArray(parsed.chains) ? parsed.chains.map((value) => Number(value)) : null
    const underlyingAssets = normalizeUnderlyingAssetList(
      Array.isArray(parsed.underlyingAssets) ? parsed.underlyingAssets : null
    )
    const minTvl = normalizeMinTvl(parsed.minTvl, DEFAULT_MIN_TVL)

    return {
      vaultType,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      types: types.length > 0 ? types : defaults.defaultTypes,
      categories: categories.length > 0 ? categories : defaults.defaultCategories,
      chains: normalizeChainsSelection(rawChains, getSupportedChainsForVaultType(vaultType)),
      aggressiveness: sanitizeStringList(Array.isArray(parsed.aggressiveness) ? parsed.aggressiveness : null),
      underlyingAssets,
      minTvl,
      showLegacyVaults: Boolean(parsed.showLegacyVaults),
      showHiddenVaults: false,
      showStrategies: Boolean(parsed.showStrategies),
      sortBy:
        typeof parsed.sortBy === 'string' && parsed.sortBy
          ? (parsed.sortBy as TPossibleSortBy)
          : defaults.defaultSortBy,
      sortDirection: parseSortDirection(typeof parsed.sortDirection === 'string' ? parsed.sortDirection : null)
    }
  } catch {
    return null
  }
}

export function useVaultsQueryState(config: TVaultsQueryStateConfig): TVaultsQueryState {
  const pathname = usePathname() || config.defaultPathname || '/vaults'
  const router = useRouter()
  const defaults = useMemo(
    (): TVaultsQueryDefaults => ({
      defaultTypes: config.defaultTypes ?? [],
      defaultCategories: config.defaultCategories ?? [],
      defaultSortBy: config.defaultSortBy ?? DEFAULT_VAULT_QUERY_SORT_BY
    }),
    [config.defaultCategories, config.defaultSortBy, config.defaultTypes]
  )
  const { defaultCategories, defaultSortBy, defaultTypes } = defaults
  const storageKey = config.storageKey ?? ''
  const shouldPersistToStorage = Boolean(config.persistToStorage && storageKey)
  const shouldClearUrlAfterInit = Boolean(config.clearUrlAfterInit)
  const shouldShareUpdateUrl = config.shareUpdatesUrl ?? true
  const shouldSyncUrlOnChange = Boolean(config.syncUrlOnChange)
  const isInitialMountRef = useRef(true)
  const isOwnUrlUpdateRef = useRef(false)
  const getCurrentUrlSearchParams = useCallback((): URLSearchParams => {
    if (typeof window === 'undefined') {
      return new URLSearchParams()
    }
    return new URLSearchParams(window.location.search)
  }, [])
  const replaceSearchParams = useCallback(
    (nextParams: URLSearchParams): void => {
      const query = nextParams.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    },
    [pathname, router]
  )

  const [snapshot, setSnapshot] = useState<TVaultsQuerySnapshot>(() => {
    if (config.initialSnapshot) {
      return config.initialSnapshot
    }
    const initialParams = getCurrentUrlSearchParams()
    if (hasVaultQueryParams(initialParams)) {
      return buildSnapshotFromParams(initialParams, defaults)
    }
    if (shouldSyncUrlOnChange) {
      return buildSnapshotFromParams(new URLSearchParams(), defaults)
    }
    if (shouldPersistToStorage) {
      const storedSnapshot = readSnapshotFromStorage(storageKey, defaults)
      if (storedSnapshot) {
        return storedSnapshot
      }
    }
    return buildSnapshotFromParams(new URLSearchParams(), defaults)
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncSnapshotFromLocation = (): void => {
      const urlSearchParams = getCurrentUrlSearchParams()
      if (!hasVaultQueryParams(urlSearchParams)) {
        return
      }
      if (isOwnUrlUpdateRef.current) {
        isOwnUrlUpdateRef.current = false
        return
      }
      const nextSnapshot = buildSnapshotFromParams(urlSearchParams, defaults)
      setSnapshot((prev) => (areQuerySnapshotsEqual(prev, nextSnapshot) ? prev : nextSnapshot))
      if (!shouldClearUrlAfterInit) {
        return
      }
      const clearedParams = clearVaultQueryParams(urlSearchParams)
      if (clearedParams.toString() !== urlSearchParams.toString()) {
        replaceSearchParams(clearedParams)
      }
    }

    syncSnapshotFromLocation()
    window.addEventListener('popstate', syncSnapshotFromLocation)
    return () => window.removeEventListener('popstate', syncSnapshotFromLocation)
  }, [defaults, getCurrentUrlSearchParams, replaceSearchParams, shouldClearUrlAfterInit])

  useEffect(() => {
    if (!shouldPersistToStorage || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
  }, [snapshot, shouldPersistToStorage, storageKey])

  const hasTypesParam = useMemo(
    () => !areStringListsEqual(snapshot.types, defaultTypes),
    [snapshot.types, defaultTypes]
  )

  const onSearch = useCallback((value: string): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({ ...prev, search: value }))
  }, [])

  const onChangeTypes = useCallback(
    (value: string[] | null): void => {
      isOwnUrlUpdateRef.current = true
      const nextTypes = normalizeV3Types(value && value.length > 0 ? value : defaultTypes)
      setSnapshot((prev) => ({ ...prev, types: nextTypes }))
    },
    [defaultTypes]
  )

  const onChangeCategories = useCallback(
    (value: string[] | null): void => {
      isOwnUrlUpdateRef.current = true
      const nextCategories = sanitizeStringList(value && value.length > 0 ? value : defaultCategories)
      setSnapshot((prev) => ({ ...prev, categories: nextCategories }))
    },
    [defaultCategories]
  )

  const onChangeChains = useCallback((value: number[] | null): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => {
      const supportedChains = getSupportedChainsForVaultType(prev.vaultType)
      const nextChains = normalizeChainsSelection(value, supportedChains)
      return { ...prev, chains: nextChains }
    })
  }, [])

  const onChangeAggressiveness = useCallback((value: string[] | null): void => {
    isOwnUrlUpdateRef.current = true
    const nextAggressiveness = sanitizeStringList(value)
    setSnapshot((prev) => ({ ...prev, aggressiveness: nextAggressiveness }))
  }, [])

  const onChangeUnderlyingAssets = useCallback((value: string[] | null): void => {
    isOwnUrlUpdateRef.current = true
    const nextAssets = normalizeUnderlyingAssetList(value)
    setSnapshot((prev) => ({ ...prev, underlyingAssets: nextAssets }))
  }, [])

  const onChangeMinTvl = useCallback((value: number): void => {
    isOwnUrlUpdateRef.current = true
    const nextMinTvl = normalizeMinTvl(value, DEFAULT_MIN_TVL)
    setSnapshot((prev) => ({ ...prev, minTvl: nextMinTvl }))
  }, [])

  const onChangeShowLegacyVaults = useCallback((value: boolean): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({ ...prev, showLegacyVaults: value }))
  }, [])

  const onChangeShowHiddenVaults = useCallback((_value: boolean): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({ ...prev, showHiddenVaults: false }))
  }, [])

  const onChangeShowStrategies = useCallback((value: boolean): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({ ...prev, showStrategies: value }))
  }, [])

  const onChangeVaultType = useCallback((nextType: TVaultType): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => {
      const nextChains = normalizeChainsSelection(prev.chains, getSupportedChainsForVaultType(nextType))
      return { ...prev, vaultType: nextType, chains: nextChains }
    })
  }, [])

  const onChangeSortBy = useCallback(
    (value: TPossibleSortBy | ''): void => {
      isOwnUrlUpdateRef.current = true
      setSnapshot((prev) => ({ ...prev, sortBy: value || defaultSortBy }))
    },
    [defaultSortBy]
  )

  const onChangeSortDirection = useCallback((value: TSortDirection | ''): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({ ...prev, sortDirection: value || 'desc' }))
  }, [])

  const onResetMultiSelect = useCallback((): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({
      ...prev,
      types: defaultTypes,
      categories: defaultCategories,
      chains: null
    }))
  }, [defaultTypes, defaultCategories])

  const onResetExtraFilters = useCallback((): void => {
    isOwnUrlUpdateRef.current = true
    setSnapshot((prev) => ({
      ...prev,
      aggressiveness: [],
      underlyingAssets: [],
      minTvl: DEFAULT_MIN_TVL,
      showLegacyVaults: false,
      showHiddenVaults: false,
      showStrategies: false
    }))
  }, [])

  const buildShareParams = useCallback((): URLSearchParams => {
    return buildUrlParamsFromSnapshot(snapshot, defaults)
  }, [defaults, snapshot])

  const onShareFilters = useCallback((): void => {
    const nextParams = buildShareParams()
    if (shouldShareUpdateUrl) {
      replaceSearchParams(nextParams)
    }
    if (typeof window === 'undefined') {
      return
    }
    const query = nextParams.toString()
    const shareUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ''}`
    copyToClipboard(shareUrl)
  }, [buildShareParams, pathname, replaceSearchParams, shouldShareUpdateUrl])

  const lastSyncedQueryRef = useRef<string | null>(null)

  useEffect(() => {
    if (!shouldSyncUrlOnChange) {
      return
    }
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      const currentParams = getCurrentUrlSearchParams()
      const nextParams = sanitizeInactiveSortParams(currentParams)
      if (nextParams.toString() === currentParams.toString()) {
        return
      }
      const nextQuery = nextParams.toString()
      lastSyncedQueryRef.current = nextQuery
      isOwnUrlUpdateRef.current = true
      startTransition(() => {
        replaceSearchParams(nextParams)
      })
      return
    }
    const nextParams = buildUrlParamsFromSnapshot(snapshot, defaults)
    const nextQuery = nextParams.toString()
    const currentQuery = getCurrentUrlSearchParams().toString()
    if (nextQuery === currentQuery || nextQuery === lastSyncedQueryRef.current) {
      return
    }
    lastSyncedQueryRef.current = nextQuery
    isOwnUrlUpdateRef.current = true
    startTransition(() => {
      replaceSearchParams(nextParams)
    })
  }, [snapshot, defaults, getCurrentUrlSearchParams, replaceSearchParams, shouldSyncUrlOnChange])

  return {
    vaultType: snapshot.vaultType,
    hasTypesParam,
    search: snapshot.search,
    types: snapshot.types,
    categories: snapshot.categories,
    chains: snapshot.chains,
    aggressiveness: snapshot.aggressiveness,
    underlyingAssets: snapshot.underlyingAssets,
    minTvl: snapshot.minTvl,
    showLegacyVaults: snapshot.showLegacyVaults,
    showHiddenVaults: snapshot.showHiddenVaults,
    showStrategies: snapshot.showStrategies,
    sortBy: snapshot.sortBy,
    sortDirection: snapshot.sortDirection,
    onSearch,
    onChangeTypes,
    onChangeCategories,
    onChangeChains,
    onChangeAggressiveness,
    onChangeUnderlyingAssets,
    onChangeMinTvl,
    onChangeShowLegacyVaults,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onChangeVaultType,
    onChangeSortBy,
    onChangeSortDirection,
    onResetMultiSelect,
    onResetExtraFilters,
    onShareFilters
  }
}
