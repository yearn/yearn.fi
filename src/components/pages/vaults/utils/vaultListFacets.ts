import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { isAutomatedVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'

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
  'SDAI'
])

const AGGRESSIVENESS_OVERRIDES: Record<string, TVaultAggressiveness> = {}
const ALLOCATOR_VAULT_OVERRIDES = new Set([`1:${toAddress('0x27B5739e22ad9033bcBf192059122d163b60349D')}`])

function getVaultKey(vault: TYDaemonVault): string {
  return `${vault.chainID}:${toAddress(vault.address)}`
}

function getVaultHaystack(vault: TYDaemonVault): string {
  return `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol}`.toLowerCase()
}

export function deriveAssetCategory(vault: TYDaemonVault): TVaultAssetCategory {
  if (vault.category === 'Stablecoin' || vault.category === 'Volatile') {
    return vault.category
  }

  const tokenSymbol = String(vault.token.symbol || '').toUpperCase()
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

export function deriveListKind(vault: TYDaemonVault): TVaultListKind {
  if (isAllocatorVaultOverride(vault)) {
    return 'allocator'
  }
  const isV3 = Boolean(vault.version?.startsWith('3') || vault.version?.startsWith('~3'))
  if (isV3) {
    if (vault.kind === 'Multi Strategy') {
      return 'allocator'
    }
    return 'strategy'
  }

  const name = String(vault.name || '').toLowerCase()
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

export function deriveV3Aggressiveness(vault: TYDaemonVault): TVaultAggressiveness | null {
  const override = AGGRESSIVENESS_OVERRIDES[getVaultKey(vault)]
  if (override) {
    return override
  }

  const riskLevel = vault.info?.riskLevel
  if (typeof riskLevel === 'number') {
    const mapped = getAggressivenessForRiskLevel(riskLevel)
    if (mapped) {
      return mapped
    }
  }

  return null
}

export function isAllocatorVaultOverride(vault: TYDaemonVault): boolean {
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
