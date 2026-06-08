import {
  getVaultAddress,
  getVaultAPR,
  getVaultCategory,
  getVaultChainID,
  getVaultInfo,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { patchYBoldVaults } from '@pages/vaults/domain/normalizeVault'
import { DEFAULT_MIN_TVL, selectVaultsByType } from '@pages/vaults/utils/constants'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveV3Aggressiveness,
  expandUnderlyingAssetSelection,
  isAllocatorVaultOverride,
  normalizeUnderlyingAssetSymbol,
  type TVaultAggressiveness
} from '@pages/vaults/utils/vaultListFacets'
import type { TVaultsQuerySnapshot } from '@pages/vaults/utils/vaultsQueryState'
import { YEARN_VAULT_LIST_ENDPOINT } from '@shared/data/publicQueryEndpoints'
import { isV3Vault, matchesSearch, matchesSelectedChains } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { SUPPORTED_NETWORKS, toAddress } from '@shared/utils'
import { fetchWithSchema } from '@shared/utils/fetchQuery'
import { numberSort, stringSort } from '@shared/utils/helpers'
import { kongVaultListSchema, type TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { calculateVaultEstimatedAPY } from '@shared/utils/vaultApy'

const PUBLIC_VAULT_LIST_TIMEOUT_MS = 7000
const PUBLIC_VAULT_LIST_LIMIT = 24
const DEFAULT_CHAIN_IDS = SUPPORTED_NETWORKS.map((network) => network.id)

export type TPublicVaultListItem = {
  key: string
  href: string
  name: string
  symbol: string
  tokenSymbol: string
  tokenName: string
  chainID: number
  chainName: string
  category: string
  productLabel: string
  estimatedApy: number
  tvl: number
}

export type TPublicVaultListViewModel = {
  vaults: TPublicVaultListItem[]
  totalMatchingVaults: number
}

type TVaultIndexEntry = {
  vault: TKongVault
  kind: ReturnType<typeof deriveListKind>
  category: string
  aggressiveness: TVaultAggressiveness | null
  isHidden: boolean
  isFeatured: boolean
  isActive: boolean
}

function toVaultDict(vaults: TKongVaultListItem[]): Record<string, TKongVaultListItem> {
  return vaults.reduce<Record<string, TKongVaultListItem>>((acc, vault) => {
    acc[toAddress(vault.address)] = vault
    return acc
  }, {})
}

function isPublicYearnVault(vault: TKongVaultListItem): boolean {
  return vault.origin === 'yearn' && vault.inclusion?.isYearn !== false
}

function getChainName(chainID: number): string {
  return SUPPORTED_NETWORKS.find((network) => network.id === chainID)?.name ?? `Chain ${chainID}`
}

function getProductLabel(kind: ReturnType<typeof deriveListKind>): string {
  if (kind === 'allocator') {
    return 'V3'
  }
  if (kind === 'strategy') {
    return 'Strategy'
  }
  if (kind === 'legacy') {
    return 'Legacy'
  }
  return 'LP'
}

function getVaultProductType(vault: TKongVault): 'v3' | 'factory' {
  return isV3Vault(vault, isAllocatorVaultOverride(vault)) ? 'v3' : 'factory'
}

function getVaultSearchKind(kind: ReturnType<typeof deriveListKind>): 'multi' | 'single' | 'factory' | 'legacy' {
  if (kind === 'allocator') {
    return 'multi'
  }
  if (kind === 'strategy') {
    return 'single'
  }
  return kind
}

function toVaultIndexEntry(vault: TKongVault): TVaultIndexEntry {
  const info = getVaultInfo(vault)
  const kind = deriveListKind(vault)
  return {
    vault,
    kind,
    category: deriveAssetCategory(vault),
    aggressiveness: deriveV3Aggressiveness(vault),
    isHidden: Boolean(info.isHidden),
    isFeatured: Boolean(info.isHighlighted),
    isActive: !info.isRetired
  }
}

function getResolvedV3Types(query: TVaultsQuerySnapshot): string[] {
  if (!query.showStrategies) {
    return ['multi']
  }
  if (query.types.length === 0) {
    return ['multi', 'single']
  }
  return query.types
}

function matchesSelectedKind({
  productType,
  selectedKind,
  query
}: {
  productType: 'v3' | 'factory'
  selectedKind: ReturnType<typeof getVaultSearchKind>
  query: TVaultsQuerySnapshot
}): boolean {
  if (productType === 'v3') {
    return getResolvedV3Types(query).includes(selectedKind)
  }
  return selectedKind === 'factory' || (query.showLegacyVaults && selectedKind === 'legacy')
}

function matchesPublicVaultFilters(entry: TVaultIndexEntry, query: TVaultsQuerySnapshot): boolean {
  const { vault, kind, category, aggressiveness, isHidden, isFeatured, isActive } = entry
  const productType = getVaultProductType(vault)
  const hasChainFilter = Boolean(query.chains?.length)
  const hasCategoryFilter = query.categories.length > 0
  const hasAggressivenessFilter = query.aggressiveness.length > 0
  const hasUnderlyingAssetFilter = query.underlyingAssets.length > 0
  const minTvlValue = Number.isFinite(query.minTvl) ? Math.max(0, query.minTvl || 0) : DEFAULT_MIN_TVL
  const normalizedUnderlyingAssets = new Set(
    query.underlyingAssets.map((asset) => normalizeUnderlyingAssetSymbol(asset)).filter(Boolean)
  )
  const expandedUnderlyingAssets = expandUnderlyingAssetSelection(normalizedUnderlyingAssets)
  const assetKey = normalizeUnderlyingAssetSymbol(getVaultToken(vault).symbol)
  const isStrategy = kind === 'strategy'
  const selectedKind = getVaultSearchKind(kind)
  const shouldShowHidden = Boolean(query.showHiddenVaults)
  const shouldIncludeByFeaturedGate = shouldShowHidden || isStrategy || isFeatured

  return (
    isActive &&
    (query.vaultType === 'all' || query.vaultType === productType) &&
    (shouldShowHidden || !isHidden) &&
    matchesSearch(vault, query.search) &&
    (!hasChainFilter || matchesSelectedChains(getVaultChainID(vault), query.chains)) &&
    (getVaultTVL(vault).tvl || 0) >= minTvlValue &&
    (!hasCategoryFilter || query.categories.includes(category)) &&
    (!hasAggressivenessFilter || (aggressiveness !== null && query.aggressiveness.includes(aggressiveness))) &&
    (!hasUnderlyingAssetFilter || Boolean(assetKey && expandedUnderlyingAssets.has(assetKey))) &&
    matchesSelectedKind({ productType, selectedKind, query }) &&
    shouldIncludeByFeaturedGate
  )
}

function sortVaults(
  vaults: TKongVault[],
  sortBy: TVaultsQuerySnapshot['sortBy'],
  sortDirection: TSortDirection
): TKongVault[] {
  if (sortDirection === '') {
    return vaults
  }

  switch (sortBy) {
    case 'name':
      return vaults.toSorted((a, b) =>
        stringSort({
          a: getVaultName(a),
          b: getVaultName(b),
          sortDirection
        })
      )
    case 'APY':
      return vaults.toSorted((a, b) =>
        numberSort({ a: getVaultAPR(a).netAPR || 0, b: getVaultAPR(b).netAPR || 0, sortDirection })
      )
    case 'estAPY':
      return vaults.toSorted((a, b) =>
        numberSort({ a: calculateVaultEstimatedAPY(a), b: calculateVaultEstimatedAPY(b), sortDirection })
      )
    case 'tvl':
      return vaults.toSorted((a, b) => numberSort({ a: getVaultTVL(a).tvl, b: getVaultTVL(b).tvl, sortDirection }))
    default:
      return vaults.toSorted((a, b) => numberSort({ a: getVaultTVL(a).tvl, b: getVaultTVL(b).tvl, sortDirection }))
  }
}

function toPublicVaultListItem(vault: TKongVault): TPublicVaultListItem {
  const chainID = getVaultChainID(vault)
  const address = toAddress(getVaultAddress(vault))
  const token = getVaultToken(vault)
  const kind = deriveListKind(vault)
  return {
    key: `${chainID}_${address}`,
    href: `/vaults/${chainID}/${address}`,
    name: getVaultName(vault),
    symbol: getVaultSymbol(vault),
    tokenSymbol: token.symbol,
    tokenName: token.name,
    chainID,
    chainName: getChainName(chainID),
    category: getVaultCategory(vault) || deriveAssetCategory(vault),
    productLabel: getProductLabel(kind),
    estimatedApy: calculateVaultEstimatedAPY(vault),
    tvl: getVaultTVL(vault).tvl
  }
}

export async function getPublicVaultListViewModel(query: TVaultsQuerySnapshot): Promise<TPublicVaultListViewModel> {
  try {
    const rawVaults = await fetchWithSchema(YEARN_VAULT_LIST_ENDPOINT, kongVaultListSchema, {
      timeout: PUBLIC_VAULT_LIST_TIMEOUT_MS
    })
    const catalogVaults = rawVaults
      .filter((vault) => DEFAULT_CHAIN_IDS.includes(vault.chainId))
      .filter(isPublicYearnVault)
    const patchedVaults = Object.values(patchYBoldVaults(toVaultDict(catalogVaults)))
    const v3Vaults = patchedVaults.filter((vault) => getVaultProductType(vault) === 'v3')
    const v2Vaults = patchedVaults.filter((vault) => getVaultProductType(vault) === 'factory')
    const entries = selectVaultsByType(query.vaultType, v3Vaults, v2Vaults, true)
      .map(toVaultIndexEntry)
      .filter((entry) => matchesPublicVaultFilters(entry, query))
    const sortedVaults = sortVaults(
      entries.map((entry) => entry.vault),
      query.sortBy,
      query.sortDirection
    )

    return {
      vaults: sortedVaults.slice(0, PUBLIC_VAULT_LIST_LIMIT).map(toPublicVaultListItem),
      totalMatchingVaults: sortedVaults.length
    }
  } catch (error) {
    console.warn('[SSR] Failed to build public vault list view model', error)
    return {
      vaults: [],
      totalMatchingVaults: 0
    }
  }
}
