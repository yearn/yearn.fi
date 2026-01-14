import type { TSortDirection } from '@lib/types'
import { copyToClipboard } from '@lib/utils/helpers'
import type { TPossibleSortBy } from '@vaults/shared/hooks/useSortVaults'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { readBooleanParam } from './constants'
import type { TVaultType } from './vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam } from './vaultTypeUtils'

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
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeAggressiveness: (value: string[] | null) => void
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

type TVaultsQuerySnapshot = {
  vaultType: TVaultType
  search: string
  types: string[]
  categories: string[]
  chains: number[] | null
  aggressiveness: string[]
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
}

type TNormalizedSortDirection = 'asc' | 'desc'

const DEFAULT_SORT_DIRECTION: TNormalizedSortDirection = 'desc'
const V3_TYPES = new Set(['multi', 'single'])
const VAULTS_QUERY_KEYS = [
  'type',
  'search',
  'types',
  'categories',
  'chains',
  'aggr',
  'showLegacy',
  'showHidden',
  'showStrategies',
  'sortBy',
  'sortDirection'
]

function hasVaultQueryParams(params: URLSearchParams): boolean {
  return VAULTS_QUERY_KEYS.some((key) => params.has(key))
}

function clearVaultQueryParams(params: URLSearchParams): URLSearchParams {
  const nextParams = new URLSearchParams(params)
  VAULTS_QUERY_KEYS.forEach((key) => {
    nextParams.delete(key)
  })
  return nextParams
}

function sanitizeStringList(values: string[] | null | undefined): string[] {
  if (!values || values.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const sanitized: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    sanitized.push(trimmed)
  }
  return sanitized
}

function sanitizeNumberList(values: number[] | null | undefined): number[] {
  if (!values || values.length === 0) {
    return []
  }
  const seen = new Set<number>()
  const sanitized: number[] = []
  for (const value of values) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || seen.has(numeric)) {
      continue
    }
    seen.add(numeric)
    sanitized.push(numeric)
  }
  return sanitized
}

function normalizeStringList(values: string[] | null | undefined): string[] {
  const sanitized = sanitizeStringList(values)
  return sanitized.sort((left, right) => left.localeCompare(right))
}

function normalizeNumberList(values: number[] | null | undefined): number[] {
  const sanitized = sanitizeNumberList(values)
  return sanitized.sort((left, right) => left - right)
}

function areStringListsEqual(left: string[] | null | undefined, right: string[] | null | undefined): boolean {
  const normalizedLeft = normalizeStringList(left)
  const normalizedRight = normalizeStringList(right)
  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function areNumberListsEqual(left: number[] | null | undefined, right: number[] | null | undefined): boolean {
  const normalizedLeft = normalizeNumberList(left)
  const normalizedRight = normalizeNumberList(right)
  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function parseStringList(raw: string | null): string[] {
  if (!raw || raw === 'none') {
    return []
  }
  return sanitizeStringList(
    raw
      .split('_')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

function parseNumberList(raw: string | null): number[] {
  if (!raw || raw === '0') {
    return []
  }
  return sanitizeNumberList(
    raw
      .split('_')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  )
}

function normalizeV3Types(types: string[] | null | undefined): string[] {
  return sanitizeStringList(types).filter((value) => V3_TYPES.has(value))
}

function normalizeChainsSelection(values: number[] | null | undefined, supportedChains: number[]): number[] | null {
  const supportedSet = new Set(supportedChains)
  const normalized = normalizeNumberList(values).filter((chainId) => supportedSet.has(chainId))
  if (normalized.length === 0) {
    return null
  }
  const normalizedSupported = normalizeNumberList(supportedChains)
  if (
    normalized.length === normalizedSupported.length &&
    normalized.every((chainId, index) => chainId === normalizedSupported[index])
  ) {
    return null
  }
  return normalized
}

function parseSortDirection(raw: string | null): TNormalizedSortDirection {
  return raw === 'asc' || raw === 'desc' ? raw : DEFAULT_SORT_DIRECTION
}

function areQuerySnapshotsEqual(left: TVaultsQuerySnapshot, right: TVaultsQuerySnapshot): boolean {
  return (
    left.vaultType === right.vaultType &&
    left.search === right.search &&
    areStringListsEqual(left.types, right.types) &&
    areStringListsEqual(left.categories, right.categories) &&
    areNumberListsEqual(left.chains ?? [], right.chains ?? []) &&
    areStringListsEqual(left.aggressiveness, right.aggressiveness) &&
    left.showLegacyVaults === right.showLegacyVaults &&
    left.showHiddenVaults === right.showHiddenVaults &&
    left.showStrategies === right.showStrategies &&
    left.sortBy === right.sortBy &&
    left.sortDirection === right.sortDirection
  )
}

function buildSnapshotFromParams(
  params: URLSearchParams,
  defaults: {
    defaultTypes: string[]
    defaultCategories: string[]
    defaultSortBy: TPossibleSortBy
  }
): TVaultsQuerySnapshot {
  const vaultType = normalizeVaultTypeParam(params.get('type'))
  const rawTypes = parseStringList(params.get('types'))
  const hasTypesParam = params.has('types')
  const normalizedTypes = normalizeV3Types(rawTypes)
  const types = hasTypesParam ? normalizedTypes : defaults.defaultTypes
  const categories = params.has('categories') ? parseStringList(params.get('categories')) : defaults.defaultCategories
  const chains = normalizeChainsSelection(
    parseNumberList(params.get('chains')),
    getSupportedChainsForVaultType(vaultType)
  )
  const aggressiveness = parseStringList(params.get('aggr'))
  const search = params.get('search') ?? ''
  const showLegacyParam = params.get('showLegacy')
  const showLegacyFromParam = showLegacyParam !== null ? readBooleanParam(params, 'showLegacy') : false
  const legacyFallback = rawTypes.includes('legacy')
  const showLegacyVaults = showLegacyParam !== null ? showLegacyFromParam : legacyFallback
  const showHiddenVaults = readBooleanParam(params, 'showHidden')
  const showStrategies = readBooleanParam(params, 'showStrategies')
  const sortBy = (params.get('sortBy') as TPossibleSortBy) || defaults.defaultSortBy
  const sortDirection = parseSortDirection(params.get('sortDirection'))

  return {
    vaultType,
    search,
    types,
    categories,
    chains,
    aggressiveness,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    sortBy,
    sortDirection
  }
}

function readSnapshotFromStorage(
  storageKey: string,
  defaults: {
    defaultTypes: string[]
    defaultCategories: string[]
    defaultSortBy: TPossibleSortBy
  }
): TVaultsQuerySnapshot | null {
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

    return {
      vaultType,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      types: types.length > 0 ? types : defaults.defaultTypes,
      categories: categories.length > 0 ? categories : defaults.defaultCategories,
      chains: normalizeChainsSelection(rawChains, getSupportedChainsForVaultType(vaultType)),
      aggressiveness: sanitizeStringList(Array.isArray(parsed.aggressiveness) ? parsed.aggressiveness : null),
      showLegacyVaults: Boolean(parsed.showLegacyVaults),
      showHiddenVaults: Boolean(parsed.showHiddenVaults),
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
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const defaultSortBy = config.defaultSortBy || 'featuringScore'
  const defaultTypes = useMemo(() => config.defaultTypes ?? [], [config.defaultTypes])
  const defaultCategories = useMemo(() => config.defaultCategories ?? [], [config.defaultCategories])
  const storageKey = config.storageKey ?? ''
  const shouldPersistToStorage = Boolean(config.persistToStorage && storageKey)
  const shouldClearUrlAfterInit = Boolean(config.clearUrlAfterInit)
  const shouldShareUpdateUrl = config.shareUpdatesUrl ?? true

  const [snapshot, setSnapshot] = useState<TVaultsQuerySnapshot>(() =>
    (() => {
      const defaults = {
        defaultTypes,
        defaultCategories,
        defaultSortBy
      }
      if (hasVaultQueryParams(searchParams)) {
        return buildSnapshotFromParams(searchParams, defaults)
      }
      if (shouldPersistToStorage) {
        const storedSnapshot = readSnapshotFromStorage(storageKey, defaults)
        if (storedSnapshot) {
          return storedSnapshot
        }
      }
      return buildSnapshotFromParams(new URLSearchParams(), defaults)
    })()
  )

  const hasVaultParams = useMemo(() => hasVaultQueryParams(searchParams), [searchParams])

  useEffect(() => {
    if (!hasVaultParams) {
      return
    }
    const nextSnapshot = buildSnapshotFromParams(searchParams, {
      defaultTypes,
      defaultCategories,
      defaultSortBy
    })
    setSnapshot((prev) => (areQuerySnapshotsEqual(prev, nextSnapshot) ? prev : nextSnapshot))
    if (!shouldClearUrlAfterInit) {
      return
    }
    const clearedParams = clearVaultQueryParams(searchParams)
    if (clearedParams.toString() !== searchParams.toString()) {
      setSearchParams(clearedParams, { replace: true })
    }
  }, [
    hasVaultParams,
    defaultTypes,
    defaultCategories,
    defaultSortBy,
    searchParams,
    setSearchParams,
    shouldClearUrlAfterInit
  ])

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
    setSnapshot((prev) => ({ ...prev, search: value }))
  }, [])

  const onChangeTypes = useCallback(
    (value: string[] | null): void => {
      const nextTypes = normalizeV3Types(value && value.length > 0 ? value : defaultTypes)
      setSnapshot((prev) => ({ ...prev, types: nextTypes }))
    },
    [defaultTypes]
  )

  const onChangeCategories = useCallback(
    (value: string[] | null): void => {
      const nextCategories = sanitizeStringList(value && value.length > 0 ? value : defaultCategories)
      setSnapshot((prev) => ({ ...prev, categories: nextCategories }))
    },
    [defaultCategories]
  )

  const onChangeChains = useCallback((value: number[] | null): void => {
    setSnapshot((prev) => {
      const supportedChains = getSupportedChainsForVaultType(prev.vaultType)
      const nextChains = normalizeChainsSelection(value, supportedChains)
      return { ...prev, chains: nextChains }
    })
  }, [])

  const onChangeAggressiveness = useCallback((value: string[] | null): void => {
    const nextAggressiveness = sanitizeStringList(value)
    setSnapshot((prev) => ({ ...prev, aggressiveness: nextAggressiveness }))
  }, [])

  const onChangeShowLegacyVaults = useCallback((value: boolean): void => {
    setSnapshot((prev) => ({ ...prev, showLegacyVaults: value }))
  }, [])

  const onChangeShowHiddenVaults = useCallback((value: boolean): void => {
    setSnapshot((prev) => ({ ...prev, showHiddenVaults: value }))
  }, [])

  const onChangeShowStrategies = useCallback((value: boolean): void => {
    setSnapshot((prev) => ({ ...prev, showStrategies: value }))
  }, [])

  const onChangeVaultType = useCallback((nextType: TVaultType): void => {
    setSnapshot((prev) => {
      const nextChains = normalizeChainsSelection(prev.chains, getSupportedChainsForVaultType(nextType))
      return { ...prev, vaultType: nextType, chains: nextChains }
    })
  }, [])

  const onChangeSortBy = useCallback(
    (value: TPossibleSortBy | ''): void => {
      setSnapshot((prev) => ({ ...prev, sortBy: value || defaultSortBy }))
    },
    [defaultSortBy]
  )

  const onChangeSortDirection = useCallback((value: TSortDirection | ''): void => {
    setSnapshot((prev) => ({ ...prev, sortDirection: value || DEFAULT_SORT_DIRECTION }))
  }, [])

  const onResetMultiSelect = useCallback((): void => {
    setSnapshot((prev) => ({
      ...prev,
      types: defaultTypes,
      categories: defaultCategories,
      chains: null
    }))
  }, [defaultTypes, defaultCategories])

  const onResetExtraFilters = useCallback((): void => {
    setSnapshot((prev) => ({
      ...prev,
      aggressiveness: [],
      showLegacyVaults: false,
      showHiddenVaults: false,
      showStrategies: false
    }))
  }, [])

  const buildShareParams = useCallback((): URLSearchParams => {
    const nextParams = new URLSearchParams(searchParams)
    const supportedChains = getSupportedChainsForVaultType(snapshot.vaultType)

    if (snapshot.vaultType === 'all') {
      nextParams.delete('type')
    } else if (snapshot.vaultType === 'v3') {
      nextParams.set('type', 'single')
    } else {
      nextParams.set('type', 'lp')
    }

    const trimmedSearch = snapshot.search.trim()
    if (trimmedSearch) {
      nextParams.set('search', trimmedSearch)
    } else {
      nextParams.delete('search')
    }

    const normalizedTypes = normalizeV3Types(snapshot.types)
    if (!areStringListsEqual(normalizedTypes, defaultTypes) && normalizedTypes.length > 0) {
      nextParams.set('types', normalizeStringList(normalizedTypes).join('_'))
    } else {
      nextParams.delete('types')
    }

    const normalizedCategories = sanitizeStringList(snapshot.categories)
    if (!areStringListsEqual(normalizedCategories, defaultCategories) && normalizedCategories.length > 0) {
      nextParams.set('categories', normalizeStringList(normalizedCategories).join('_'))
    } else {
      nextParams.delete('categories')
    }

    const normalizedChains = normalizeChainsSelection(snapshot.chains, supportedChains)
    if (normalizedChains && normalizedChains.length > 0) {
      nextParams.set('chains', normalizedChains.join('_'))
    } else {
      nextParams.delete('chains')
    }

    const normalizedAggressiveness = normalizeStringList(snapshot.aggressiveness)
    if (normalizedAggressiveness.length > 0) {
      nextParams.set('aggr', normalizedAggressiveness.join('_'))
    } else {
      nextParams.delete('aggr')
    }

    if (snapshot.showLegacyVaults) {
      nextParams.set('showLegacy', '1')
    } else {
      nextParams.delete('showLegacy')
    }

    if (snapshot.showHiddenVaults) {
      nextParams.set('showHidden', '1')
    } else {
      nextParams.delete('showHidden')
    }

    if (snapshot.showStrategies) {
      nextParams.set('showStrategies', '1')
    } else {
      nextParams.delete('showStrategies')
    }

    if (snapshot.sortBy !== defaultSortBy) {
      nextParams.set('sortBy', snapshot.sortBy)
    } else {
      nextParams.delete('sortBy')
    }

    const normalizedSortDirection = parseSortDirection(snapshot.sortDirection)
    if (normalizedSortDirection !== DEFAULT_SORT_DIRECTION) {
      nextParams.set('sortDirection', normalizedSortDirection)
    } else {
      nextParams.delete('sortDirection')
    }

    return nextParams
  }, [
    searchParams,
    snapshot.vaultType,
    snapshot.search,
    snapshot.types,
    snapshot.categories,
    snapshot.chains,
    snapshot.aggressiveness,
    snapshot.showLegacyVaults,
    snapshot.showHiddenVaults,
    snapshot.showStrategies,
    snapshot.sortBy,
    snapshot.sortDirection,
    defaultTypes,
    defaultCategories,
    defaultSortBy
  ])

  const onShareFilters = useCallback((): void => {
    const nextParams = buildShareParams()
    if (shouldShareUpdateUrl) {
      setSearchParams(nextParams, { replace: true })
    }
    if (typeof window === 'undefined') {
      return
    }
    const query = nextParams.toString()
    const shareUrl = `${window.location.origin}${location.pathname}${query ? `?${query}` : ''}`
    copyToClipboard(shareUrl)
  }, [buildShareParams, location.pathname, setSearchParams, shouldShareUpdateUrl])

  return {
    vaultType: snapshot.vaultType,
    hasTypesParam,
    search: snapshot.search,
    types: snapshot.types,
    categories: snapshot.categories,
    chains: snapshot.chains,
    aggressiveness: snapshot.aggressiveness,
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
