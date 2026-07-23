import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { DEFAULT_MIN_TVL, readBooleanParam } from '@pages/vaults/utils/constants'
import { normalizeUnderlyingAssetSymbol } from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam } from '@pages/vaults/utils/vaultTypeUtils'
import type { TSortDirection } from '@shared/types'

export type TVaultsRouteSearchParams = Record<string, string | string[] | undefined>

export type TVaultsQuerySnapshot = {
  vaultType: TVaultType
  search: string
  types: string[]
  categories: string[]
  chains: number[] | null
  aggressiveness: string[]
  underlyingAssets: string[]
  minTvl: number
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
}

export type TVaultsQueryDefaults = {
  defaultTypes: string[]
  defaultCategories: string[]
  defaultSortBy: TPossibleSortBy
}

type TNormalizedSortDirection = 'asc' | 'desc'

export const DEFAULT_VAULT_QUERY_TYPES = ['multi', 'single']
export const DEFAULT_VAULT_QUERY_SORT_BY: TPossibleSortBy = 'none'
export const DEFAULT_VAULT_QUERY_DEFAULTS: TVaultsQueryDefaults = {
  defaultTypes: DEFAULT_VAULT_QUERY_TYPES,
  defaultCategories: [],
  defaultSortBy: DEFAULT_VAULT_QUERY_SORT_BY
}

const DEFAULT_SORT_DIRECTION: TNormalizedSortDirection = 'desc'
const V3_TYPES = new Set(['multi', 'single'])
const VAULTS_QUERY_KEYS = [
  'type',
  'search',
  'types',
  'categories',
  'chains',
  'aggr',
  'assets',
  'minTvl',
  'showLegacy',
  'showHidden',
  'showStrategies',
  'sortBy',
  'sortDirection'
]

export function hasVaultQueryParams(params: URLSearchParams): boolean {
  return VAULTS_QUERY_KEYS.some((key) => params.has(key))
}

export function clearVaultQueryParams(params: URLSearchParams): URLSearchParams {
  const nextParams = new URLSearchParams(params)
  VAULTS_QUERY_KEYS.forEach((key) => {
    nextParams.delete(key)
  })
  return nextParams
}

export function sanitizeStringList(values: string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
}

export function sanitizeNumberList(values: number[] | null | undefined): number[] {
  return Array.from(new Set((values ?? []).map((value) => Number(value)).filter((value) => Number.isFinite(value))))
}

export function normalizeStringList(values: string[] | null | undefined): string[] {
  return sanitizeStringList(values).sort((left, right) => left.localeCompare(right))
}

export function normalizeNumberList(values: number[] | null | undefined): number[] {
  return sanitizeNumberList(values).sort((left, right) => left - right)
}

export function normalizeUnderlyingAssetList(values: string[] | null | undefined): string[] {
  return normalizeStringList(
    sanitizeStringList(values)
      .map((value) => normalizeUnderlyingAssetSymbol(value))
      .filter(Boolean)
  )
}

export function normalizeMinTvl(value: string | number | null | undefined, fallback = DEFAULT_MIN_TVL): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(0, numeric)
}

export function areStringListsEqual(left: string[] | null | undefined, right: string[] | null | undefined): boolean {
  const normalizedLeft = normalizeStringList(left)
  const normalizedRight = normalizeStringList(right)
  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

export function areNumberListsEqual(left: number[] | null | undefined, right: number[] | null | undefined): boolean {
  const normalizedLeft = normalizeNumberList(left)
  const normalizedRight = normalizeNumberList(right)
  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

export function normalizeV3Types(types: string[] | null | undefined): string[] {
  return sanitizeStringList(types).filter((value) => V3_TYPES.has(value))
}

export function normalizeChainsSelection(
  values: number[] | null | undefined,
  supportedChains: number[]
): number[] | null {
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

export function parseSortDirection(raw: string | null): TNormalizedSortDirection {
  return raw === 'asc' || raw === 'desc' ? raw : DEFAULT_SORT_DIRECTION
}

export function sanitizeInactiveSortParams(params: URLSearchParams): URLSearchParams {
  const nextParams = new URLSearchParams(params)
  const sortBy = nextParams.get('sortBy')
  if (!sortBy || sortBy === 'none') {
    nextParams.delete('sortBy')
    nextParams.delete('sortDirection')
  }
  return nextParams
}

export function areQuerySnapshotsEqual(left: TVaultsQuerySnapshot, right: TVaultsQuerySnapshot): boolean {
  return (
    left.vaultType === right.vaultType &&
    left.search === right.search &&
    areStringListsEqual(left.types, right.types) &&
    areStringListsEqual(left.categories, right.categories) &&
    areNumberListsEqual(left.chains ?? [], right.chains ?? []) &&
    areStringListsEqual(left.aggressiveness, right.aggressiveness) &&
    areStringListsEqual(left.underlyingAssets, right.underlyingAssets) &&
    left.minTvl === right.minTvl &&
    left.showLegacyVaults === right.showLegacyVaults &&
    left.showHiddenVaults === right.showHiddenVaults &&
    left.showStrategies === right.showStrategies &&
    left.sortBy === right.sortBy &&
    left.sortDirection === right.sortDirection
  )
}

export function parseStringList(raw: string | null): string[] {
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

export function parseNumberList(raw: string | null): number[] {
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

export function buildSnapshotFromParams(
  params: URLSearchParams,
  defaults: TVaultsQueryDefaults = DEFAULT_VAULT_QUERY_DEFAULTS
): TVaultsQuerySnapshot {
  const vaultType = normalizeVaultTypeParam(params.get('type'))
  const rawSortBy = params.get('sortBy')
  const rawTypes = parseStringList(params.get('types'))
  const hasTypesParam = params.has('types')
  const normalizedTypes = normalizeV3Types(rawTypes)
  const showLegacyParam = params.get('showLegacy')
  const showLegacyFromParam = showLegacyParam !== null ? readBooleanParam(params, 'showLegacy') : false
  const sortBy = rawSortBy && rawSortBy !== 'none' ? (rawSortBy as TPossibleSortBy) : defaults.defaultSortBy

  return {
    vaultType,
    search: params.get('search') ?? '',
    types: hasTypesParam ? normalizedTypes : defaults.defaultTypes,
    categories: params.has('categories') ? parseStringList(params.get('categories')) : defaults.defaultCategories,
    chains: normalizeChainsSelection(parseNumberList(params.get('chains')), getSupportedChainsForVaultType(vaultType)),
    aggressiveness: parseStringList(params.get('aggr')),
    underlyingAssets: normalizeUnderlyingAssetList(params.has('assets') ? parseStringList(params.get('assets')) : []),
    minTvl: normalizeMinTvl(params.get('minTvl'), DEFAULT_MIN_TVL),
    showLegacyVaults: showLegacyParam !== null ? showLegacyFromParam : rawTypes.includes('legacy'),
    showHiddenVaults: false,
    showStrategies: readBooleanParam(params, 'showStrategies'),
    sortBy,
    sortDirection: sortBy === 'none' ? DEFAULT_SORT_DIRECTION : parseSortDirection(params.get('sortDirection'))
  }
}

export function buildUrlParamsFromSnapshot(
  snap: TVaultsQuerySnapshot,
  defaults: TVaultsQueryDefaults = DEFAULT_VAULT_QUERY_DEFAULTS
): URLSearchParams {
  const params = new URLSearchParams()
  const supportedChains = getSupportedChainsForVaultType(snap.vaultType)
  const trimmedSearch = snap.search.trim()
  const normalizedTypes = normalizeV3Types(snap.types)
  const normalizedCategories = sanitizeStringList(snap.categories)
  const normalizedChains = normalizeChainsSelection(snap.chains, supportedChains)
  const normalizedAggressiveness = normalizeStringList(snap.aggressiveness)
  const normalizedUnderlyingAssets = normalizeUnderlyingAssetList(snap.underlyingAssets)
  const normalizedSortDirection = parseSortDirection(snap.sortDirection)

  if (snap.vaultType === 'v3') {
    params.set('type', 'single')
  } else if (snap.vaultType === 'factory') {
    params.set('type', 'lp')
  }

  if (trimmedSearch) {
    params.set('search', trimmedSearch)
  }

  if (!areStringListsEqual(normalizedTypes, defaults.defaultTypes) && normalizedTypes.length > 0) {
    params.set('types', normalizeStringList(normalizedTypes).join('_'))
  }

  if (!areStringListsEqual(normalizedCategories, defaults.defaultCategories) && normalizedCategories.length > 0) {
    params.set('categories', normalizeStringList(normalizedCategories).join('_'))
  }

  if (normalizedChains && normalizedChains.length > 0) {
    params.set('chains', normalizedChains.join('_'))
  }

  if (normalizedAggressiveness.length > 0) {
    params.set('aggr', normalizedAggressiveness.join('_'))
  }

  if (normalizedUnderlyingAssets.length > 0) {
    params.set('assets', normalizedUnderlyingAssets.join('_'))
  }

  if (snap.minTvl !== DEFAULT_MIN_TVL) {
    params.set('minTvl', String(snap.minTvl))
  }

  if (snap.showLegacyVaults) {
    params.set('showLegacy', '1')
  }

  if (snap.showStrategies) {
    params.set('showStrategies', '1')
  }

  if (snap.sortBy !== 'none') {
    params.set('sortBy', snap.sortBy)
  }

  if (snap.sortBy !== 'none' && normalizedSortDirection !== DEFAULT_SORT_DIRECTION) {
    params.set('sortDirection', normalizedSortDirection)
  }

  return params
}

export function buildUrlSearchParamsFromRouteSearchParams(
  searchParams?: TVaultsRouteSearchParams | null
): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        params.append(key, entry)
      })
      return
    }
    params.set(key, value)
  })
  return params
}

export function buildInitialVaultsQuerySnapshot(
  searchParams?: TVaultsRouteSearchParams | null,
  defaults: TVaultsQueryDefaults = DEFAULT_VAULT_QUERY_DEFAULTS
): TVaultsQuerySnapshot {
  return buildSnapshotFromParams(buildUrlSearchParamsFromRouteSearchParams(searchParams), defaults)
}
