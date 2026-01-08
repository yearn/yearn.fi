import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { isAutomatedVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'

export type TVaultAssetCategory = 'Stablecoin' | 'Volatile'
export type TVaultListKind = 'allocator' | 'strategy' | 'factory' | 'legacy'
export type TVaultProtocol =
  | 'Curve'
  | 'Velodrome'
  | 'Aerodrome'
  | 'Balancer'
  | 'Fluid'
  | 'Morpho'
  | 'Aave'
  | 'Sky'
  | 'Silo'
  | 'Compound'
  | 'Unknown'

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

const PROTOCOL_OVERRIDES: Record<string, TVaultProtocol> = {}
const AGGRESSIVENESS_OVERRIDES: Record<string, -1 | -2 | -3> = {}
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
    if (vault.kind === 'Multi Strategy') return 'allocator'
    if (vault.kind === 'Single Strategy') return 'strategy'
    return 'strategy'
  }

  const name = String(vault.name || '').toLowerCase()
  if (name.includes('factory')) return 'factory'
  if (isAutomatedVault(vault)) return 'factory'
  return 'legacy'
}

export function deriveProtocol(vault: TYDaemonVault, kind: TVaultListKind): TVaultProtocol | null {
  if (kind === 'allocator') {
    return null
  }

  const override = PROTOCOL_OVERRIDES[getVaultKey(vault)]
  if (override) {
    return override
  }

  if (vault.category === 'Curve') return 'Curve'
  if (vault.category === 'Velodrome') return 'Velodrome'
  if (vault.category === 'Aerodrome') return 'Aerodrome'
  if (vault.category === 'Balancer') return 'Balancer'

  const haystack = getVaultHaystack(vault)

  const patterns: Array<[TVaultProtocol, RegExp[]]> = [
    ['Morpho', [/\bmorpho\b/i]],
    ['Aave', [/\baave\b/i]],
    ['Compound', [/\bcompound\b/i, /\bctoken\b/i, /\bcomet\b/i]],
    ['Silo', [/\bsilo\b/i]],
    ['Fluid', [/\bfluid\b/i]],
    ['Sky', [/\bsky\b/i]],
    ['Curve', [/\bcurve\b/i, /\bcrv\b/i, /\btricrypto\b/i]],
    ['Velodrome', [/\bvelodrome\b/i, /\bvelo\b/i]],
    ['Aerodrome', [/\baerodrome\b/i, /\baero\b/i]],
    ['Balancer', [/\bbalancer\b/i, /\bbpt\b/i]]
  ]

  for (const [protocol, matchers] of patterns) {
    if (matchers.some((matcher) => matcher.test(haystack))) {
      return protocol
    }
  }

  return 'Unknown'
}

export function deriveV3Aggressiveness(vault: TYDaemonVault): -1 | -2 | -3 | null {
  const isV3 = Boolean(
    vault.version?.startsWith('3') || vault.version?.startsWith('~3') || isAllocatorVaultOverride(vault)
  )
  if (!isV3) return null

  const override = AGGRESSIVENESS_OVERRIDES[getVaultKey(vault)]
  if (override) {
    return override
  }

  const riskLevel = vault.info?.riskLevel
  if (riskLevel === -1 || riskLevel === -2 || riskLevel === -3) {
    return riskLevel
  }

  const comment = String(vault.info?.riskScoreComment || '')
  const match = comment.match(/(-1|-2|-3)/)
  if (match) {
    const value = Number(match[1])
    if (value === -1 || value === -2 || value === -3) return value
  }

  return null
}

export function isAllocatorVaultOverride(vault: TYDaemonVault): boolean {
  return ALLOCATOR_VAULT_OVERRIDES.has(getVaultKey(vault))
}
