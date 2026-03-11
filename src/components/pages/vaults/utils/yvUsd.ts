import { getVaultView, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { type Address, formatUnits, parseUnits } from 'viem'

export const YVUSD_CHAIN_ID = 1
export const YVUSD_UNLOCKED_ADDRESS = toAddress('0x696d02Db93291651ED510704c9b286841d506987') as Address
export const YVUSD_LOCKED_ADDRESS = toAddress('0xAaaFEa48472f77563961Cdb53291DEDfB46F9040') as Address
export const YVUSD_LOCKED_ZAP_ADDRESS = toAddress('0x7ba61c8e19414dcB8fe769a7Be63B508C8062bbA') as Address

export const YVUSD_LOCKED_COOLDOWN_DAYS = 14
export const YVUSD_WITHDRAW_WINDOW_DAYS = 5
export const YVUSD_CUSTOM_RISK_SCORE = '3/5'

function getYvUsdAprServiceEndpoint(): string {
  const configuredEndpoint = import.meta.env.VITE_YVUSD_APR_SERVICE_API?.trim().replace(/\/$/, '')
  if (configuredEndpoint?.startsWith('/')) {
    return configuredEndpoint
  }
  return '/api/yvusd/aprs'
}

export const YVUSD_APR_SERVICE_ENDPOINT = getYvUsdAprServiceEndpoint()

export const YVUSD_DESCRIPTION =
  'USD denominated, cross-chain, cross asset vault. Optionally lock shares to earn a higher yield by allowing the vault to take on longer duration positions.'

export type TYvUsdVariant = 'locked' | 'unlocked'
export type TYvUsdLockedWithdrawDisplayMode = 'underlying' | 'shares'
export type TYvUsdRiskScoreItem = {
  label: string
  explanation: string
  score?: number | string | null
  isOverall?: boolean
}

export const YVUSD_RISK_SCORE_ITEMS: TYvUsdRiskScoreItem[] = [
  {
    label: 'Overall Risk Score',
    score: YVUSD_CUSTOM_RISK_SCORE,
    isOverall: true,
    explanation:
      'yvUSD combines leverage looping, fixed-term and principal-token strategies, cross-chain capital routing, and a locked-share wrapper, so its risks are better described as a strategy stack rather than a single standard vault profile.'
  },
  {
    label: 'Leverage Looping',
    explanation:
      'Some yvUSD strategies use leverage loops to amplify supply yield. That adds borrow-rate risk, deleveraging and liquidation-path risk, and dependence on collateral efficiency, market depth, and the health of the underlying lending venue.'
  },
  {
    label: 'Duration and PT Strategies',
    explanation:
      'yvUSD can allocate into duration trades and Pendle principal-token strategies. Those positions depend on fixed-term market pricing, yield-curve assumptions, basis convergence into expiry, and the ability to exit or rebalance without meaningful slippage.'
  },
  {
    label: 'Cross-Chain Routing',
    explanation:
      'Capital may be deployed to remote vaults and bridged back through native bridges such as CCTP. That introduces bridge availability risk, remote chain execution risk, settlement delays, and additional operational dependencies beyond a single-chain vault.'
  }
  // {
  //   label: 'Locked / Unlocked Dynamics',
  //   explanation: `Locked yvUSD earns the base yvUSD APR plus a locker bonus, but withdrawals require a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and must be completed within a ${YVUSD_WITHDRAW_WINDOW_DAYS}-day window. Unlocked depositors stay liquid but fund part of that bonus, so yield and liquidity can diverge between the two variants during stress or large flow changes.`
  // },
  // {
  //   label: 'External Dependencies',
  //   explanation:
  //     'The strategy set relies on external protocols, bridge rails, pricing assumptions, and active management across multiple venues. Smart contract failures, governance actions, liquidity shocks, or oracle issues in any of those layers can reduce returns or impair withdrawals.'
  // }
]

export function getYvUsdInfinifiPointsNote(variant?: TYvUsdVariant): string {
  if (!variant) {
    return 'This vault earns Infinifi points through the sIUSD looper strategy.'
  }

  return `This ${variant} variant earns Infinifi points through the sIUSD looper strategy.`
}

export function isYvUsdAddress(address?: string | null): boolean {
  if (!address) return false
  const normalized = toAddress(address)
  return normalized === YVUSD_UNLOCKED_ADDRESS || normalized === YVUSD_LOCKED_ADDRESS
}

export function isYvUsdVault(vault?: TKongVaultInput | null): boolean {
  if (!vault) return false
  return isYvUsdAddress(vault.address)
}

export function getYvUsdAssetPrice(vault?: TKongVaultInput | null): number {
  if (!vault) return 0
  const view = getVaultView(vault)
  return view.tvl.price || 0
}

export function getYvUsdSharePrice(vault?: TKongVaultInput | null, fallbackAssetPrice = 0): number {
  if (!vault) return 0
  const view = getVaultView(vault)
  const assetPrice = view.tvl.price || fallbackAssetPrice
  const pricePerShare = view.apr.pricePerShare.today || 0

  if (assetPrice > 0 && pricePerShare > 0) {
    return assetPrice * pricePerShare
  }

  return assetPrice
}

function normalizeWeightedValue(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }
  return value
}

function isFiniteApy(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getWeightedYvUsdApy({
  unlockedValue,
  lockedValue,
  unlockedApy,
  lockedApy
}: {
  unlockedValue?: number | null
  lockedValue?: number | null
  unlockedApy?: number | null
  lockedApy?: number | null
}): number | null {
  const normalizedUnlockedValue = normalizeWeightedValue(unlockedValue)
  const normalizedLockedValue = normalizeWeightedValue(lockedValue)
  const totalValue = normalizedUnlockedValue + normalizedLockedValue

  if (totalValue <= 0) {
    return null
  }

  let weightedApy = 0
  let hasFiniteApy = false

  if (isFiniteApy(unlockedApy)) {
    weightedApy += normalizedUnlockedValue * unlockedApy
    hasFiniteApy = true
  }

  if (isFiniteApy(lockedApy)) {
    weightedApy += normalizedLockedValue * lockedApy
    hasFiniteApy = true
  }

  if (!hasFiniteApy) {
    return null
  }

  return weightedApy / totalValue
}

export function convertYvUsdVariantRawAmount({
  amount,
  fromVariant,
  toVariant,
  unlockedPricePerShare,
  unlockedVaultDecimals = 18
}: {
  amount: bigint
  fromVariant: TYvUsdVariant
  toVariant: TYvUsdVariant
  unlockedPricePerShare: bigint
  unlockedVaultDecimals?: number
}): bigint {
  if (amount <= 0n || fromVariant === toVariant || unlockedPricePerShare <= 0n) {
    return amount
  }

  const vaultScale = 10n ** BigInt(unlockedVaultDecimals)
  if (fromVariant === 'unlocked' && toVariant === 'locked') {
    return (amount * vaultScale) / unlockedPricePerShare
  }

  if (fromVariant === 'locked' && toVariant === 'unlocked') {
    return (amount * unlockedPricePerShare) / vaultScale
  }

  return amount
}

export function convertYvUsdVariantAmountString({
  amount,
  fromVariant,
  toVariant,
  fromDecimals,
  toDecimals,
  unlockedPricePerShare,
  unlockedVaultDecimals = 18
}: {
  amount?: string
  fromVariant: TYvUsdVariant
  toVariant: TYvUsdVariant
  fromDecimals: number
  toDecimals: number
  unlockedPricePerShare: bigint
  unlockedVaultDecimals?: number
}): string | undefined {
  if (amount === undefined) {
    return undefined
  }

  const trimmedAmount = amount.trim()
  if (trimmedAmount.length === 0 || fromVariant === toVariant || unlockedPricePerShare <= 0n) {
    return amount
  }

  try {
    const rawAmount = parseUnits(trimmedAmount, fromDecimals)
    const convertedRawAmount = convertYvUsdVariantRawAmount({
      amount: rawAmount,
      fromVariant,
      toVariant,
      unlockedPricePerShare,
      unlockedVaultDecimals
    })
    return formatUnits(convertedRawAmount, toDecimals)
  } catch {
    return amount
  }
}

export function convertYvUsdLockedAssetRawAmountToUnderlying({
  amount,
  unlockedPricePerShare,
  unlockedVaultDecimals = 18
}: {
  amount: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals?: number
}): bigint {
  return convertYvUsdVariantRawAmount({
    amount,
    fromVariant: 'locked',
    toVariant: 'unlocked',
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function convertYvUsdUnderlyingRawAmountToLockedAsset({
  amount,
  unlockedPricePerShare,
  unlockedVaultDecimals = 18
}: {
  amount: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals?: number
}): bigint {
  return convertYvUsdVariantRawAmount({
    amount,
    fromVariant: 'unlocked',
    toVariant: 'locked',
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function convertYvUsdLockedPricePerShareToUnderlying({
  lockedPricePerShare,
  unlockedPricePerShare,
  unlockedVaultDecimals = 18
}: {
  lockedPricePerShare: bigint
  unlockedPricePerShare: bigint
  unlockedVaultDecimals?: number
}): bigint {
  if (lockedPricePerShare <= 0n || unlockedPricePerShare <= 0n) {
    return 0n
  }

  return (lockedPricePerShare * unlockedPricePerShare) / 10n ** BigInt(unlockedVaultDecimals)
}

export function getYvUsdLockedWithdrawDisplayMode(_ensoEnabled?: boolean): TYvUsdLockedWithdrawDisplayMode {
  return 'underlying'
}
