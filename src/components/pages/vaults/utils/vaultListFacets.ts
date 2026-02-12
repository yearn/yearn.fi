import {
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultInfo,
  getVaultKind,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultVersion,
  isAutomatedVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'

export type TVaultAssetCategory = 'Stablecoin' | 'Volatile'
export type TVaultListKind = 'allocator' | 'strategy' | 'factory' | 'legacy'
export type TVaultAggressiveness = 'Conservative' | 'Moderate' | 'Aggressive'

export const UNDERLYING_ASSET_OVERRIDES: Record<string, string> = {
  ETH: 'ETH',
  WETH: 'ETH',
  VBETH: 'ETH'
}

const UNDERLYING_ASSET_LABEL_OVERRIDES: Record<string, string> = {}
const UNDERLYING_ASSET_GROUPS = Object.entries(UNDERLYING_ASSET_OVERRIDES).reduce(
  (acc, [symbol, group]) => {
    const normalizedSymbol = symbol.trim().toUpperCase()
    const normalizedGroup = group.trim().toUpperCase()
    if (!normalizedSymbol || !normalizedGroup) {
      return acc
    }
    if (!acc[normalizedGroup]) {
      acc[normalizedGroup] = new Set<string>()
    }
    acc[normalizedGroup].add(normalizedGroup)
    acc[normalizedGroup].add(normalizedSymbol)
    return acc
  },
  {} as Record<string, Set<string>>
)

const KNOWN_STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'FRAX',
  'LUSD',
  'TUSD',
  'USDE',
  'SUSDE',
  'GHO',
  'CRVUSD',
  'USD0',
  'PYUSD',
  'USDP',
  'SDAI',
  'AUSD',
  'BOLD'
])

const AGGRESSIVENESS_OVERRIDES: Record<string, TVaultAggressiveness> = {}
const ALLOCATOR_VAULT_OVERRIDES = new Set([`1:${toAddress('0x27B5739e22ad9033bcBf192059122d163b60349D')}`])

function getVaultKey(vault: TKongVaultInput): string {
  return `${getVaultChainID(vault)}:${toAddress(getVaultAddress(vault))}`
}

function getVaultHaystack(vault: TKongVaultInput): string {
  const token = getVaultToken(vault)
  return `${getVaultName(vault)} ${getVaultSymbol(vault)} ${token.name} ${token.symbol}`.toLowerCase()
}

export function deriveAssetCategory(vault: TKongVaultInput): TVaultAssetCategory {
  const category = getVaultCategory(vault)
  if (category === 'Stablecoin' || category === 'Volatile') {
    return category
  }

  const token = getVaultToken(vault)
  const tokenSymbol = String(token.symbol || '').toUpperCase()
  if (KNOWN_STABLECOIN_SYMBOLS.has(tokenSymbol)) {
    return 'Stablecoin'
  }

  const haystack = getVaultHaystack(vault).toUpperCase()
  for (const stable of KNOWN_STABLECOIN_SYMBOLS) {
    if (haystack.includes(stable)) {
      return 'Stablecoin'
    }
  }

  return 'Volatile'
}

export function deriveListKind(vault: TKongVaultInput): TVaultListKind {
  if (isAllocatorVaultOverride(vault)) {
    return 'allocator'
  }
  const version = getVaultVersion(vault)
  const isV3 = Boolean(version.startsWith('3') || version.startsWith('~3'))
  const kind = getVaultKind(vault)

  if (isV3) {
    if (kind === 'Multi Strategy') {
      return 'allocator'
    }
    return 'strategy'
  }

  const name = String(getVaultName(vault) || '').toLowerCase()
  if (name.includes('factory')) return 'factory'
  if (isAutomatedVault(vault)) return 'factory'
  return 'legacy'
}

function getAggressivenessForRiskLevel(value: number): TVaultAggressiveness | null {
  switch (value) {
    case -1:
      return 'Conservative'
    case 0:
      return 'Conservative'
    case 1:
      return 'Conservative'
    case 2:
      return 'Moderate'
    case 3:
      return 'Aggressive'
    default:
      return null
  }
}

export function deriveV3Aggressiveness(_vault: TKongVaultInput): TVaultAggressiveness | null {
  const override = AGGRESSIVENESS_OVERRIDES[getVaultKey(_vault)]
  if (override) {
    return override
  }

  const riskLevel = getVaultInfo(_vault).riskLevel
  if (typeof riskLevel === 'number') {
    const mapped = getAggressivenessForRiskLevel(riskLevel)
    if (mapped) {
      return mapped
    }
  }

  return null
}

export function isAllocatorVaultOverride(vault: TKongVaultInput): boolean {
  return ALLOCATOR_VAULT_OVERRIDES.has(getVaultKey(vault))
}

export function normalizeUnderlyingAssetSymbol(symbol?: string | null): string {
  if (!symbol) {
    return ''
  }
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return ''
  }
  return normalized
}

export function expandUnderlyingAssetSelection(assets: Iterable<string>): Set<string> {
  const expanded = new Set<string>()
  const groupsToExpand = new Set<string>()

  for (const asset of assets) {
    const normalized = normalizeUnderlyingAssetSymbol(asset)
    if (!normalized) {
      continue
    }
    const groupKey = UNDERLYING_ASSET_OVERRIDES[normalized] ?? normalized
    if (UNDERLYING_ASSET_GROUPS[groupKey]) {
      groupsToExpand.add(groupKey)
      continue
    }
    expanded.add(normalized)
  }

  for (const groupKey of groupsToExpand) {
    const groupMembers = UNDERLYING_ASSET_GROUPS[groupKey]
    if (!groupMembers) {
      expanded.add(groupKey)
      continue
    }
    groupMembers.forEach((member) => {
      expanded.add(member)
    })
  }

  return expanded
}

export function getUnderlyingAssetLabel(assetKey: string): string {
  return UNDERLYING_ASSET_LABEL_OVERRIDES[assetKey] ?? assetKey
}
