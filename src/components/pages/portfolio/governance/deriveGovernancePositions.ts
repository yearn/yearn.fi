import {
  GOVERNANCE_STREAM_DURATION,
  LEGACY_VEYFI_ADDRESS,
  LIQUID_LOCKERS,
  STYFI_ADDRESS,
  STYFI_URL,
  STYFIX_ADDRESS,
  VEYFI_URL
} from '@pages/portfolio/governance/constants'
import type {
  TGovernanceCooldown,
  TGovernanceGlobalData,
  TGovernancePosition,
  TGovernanceRawAccount
} from '@pages/portfolio/governance/types'
import type { TAddress } from '@shared/types'
import { toAddress, toNormalizedValue } from '@shared/utils'

type TDeriveGovernancePositionsParams = {
  raw: TGovernanceRawAccount | null | undefined
  globalData: TGovernanceGlobalData | null | undefined
  yfiPrice: number
  nowSeconds?: number
}

const ONE = 10n ** 18n
const VEYFI_BOOST_EPOCHS = 104
const RATIO_SCALE = 1_000_000n

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

function toSafeBigInt(value: number | string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function addOptionalRawValues(...values: Array<number | string | null | undefined>): bigint {
  return values.reduce((sum, value) => sum + (toSafeBigInt(value) ?? 0n), 0n)
}

export function deriveCooldownEndsAt({
  claimed,
  durationSeconds,
  nowSeconds,
  total,
  withdrawable
}: {
  total: bigint
  claimed: bigint
  withdrawable: bigint
  durationSeconds: number
  nowSeconds: number
}): number {
  if (total <= 0n || durationSeconds <= 0) {
    return nowSeconds
  }

  const unlocked = claimed + withdrawable
  const clampedUnlocked = unlocked > total ? total : unlocked
  const elapsed = Number((clampedUnlocked * BigInt(durationSeconds)) / total)
  return nowSeconds + Math.max(0, durationSeconds - elapsed)
}

function deriveCooldown(
  stream: readonly [bigint, bigint, bigint],
  withdrawable: bigint,
  nowSeconds: number
): TGovernanceCooldown | null {
  const total = stream[1]
  const claimed = stream[2]
  const remaining = total > claimed ? total - claimed : 0n
  const streamWithdrawable = withdrawable < remaining ? withdrawable : remaining
  const cooling = remaining - streamWithdrawable
  if (cooling <= 0n) {
    return null
  }

  return {
    amountRaw: cooling,
    endsAt: deriveCooldownEndsAt({
      total,
      claimed,
      withdrawable,
      durationSeconds: GOVERNANCE_STREAM_DURATION,
      nowSeconds
    }),
    totalRaw: total
  }
}

export function getLlyfiYfiEquivalentRaw(amountRaw: bigint, scale: bigint): bigint {
  return scale > 0n ? amountRaw / scale : amountRaw
}

function getApyFromBps(value: number | string | null | undefined): number | null {
  const bps = toFiniteNumber(value)
  return bps === null ? null : bps / 10_000
}

function isEpochZero(globalData: TGovernanceGlobalData | null | undefined): boolean {
  return globalData?.meta.epoch === 0
}

function getEpochAprBps(
  block: { current: { aprBps: number | string }; projected: { aprBps: number | string } } | null | undefined,
  globalData: TGovernanceGlobalData | null | undefined
): number | string | null | undefined {
  if (!block) {
    return null
  }

  return isEpochZero(globalData) ? block.projected.aprBps : block.current.aprBps
}

function getStyfiApy(globalData: TGovernanceGlobalData | null | undefined): number | null {
  return getApyFromBps(getEpochAprBps(globalData?.styfi, globalData))
}

function getStyfixApy(globalData: TGovernanceGlobalData | null | undefined): number | null {
  return getApyFromBps(getEpochAprBps(globalData?.styfix, globalData)) ?? getStyfiApy(globalData)
}

function getLlyfiApy(globalData: TGovernanceGlobalData | null | undefined, symbol: string): number | null {
  const normalizedSymbol = symbol.toLowerCase()
  const match = globalData?.llyfi.find((entry) => entry.symbol.toLowerCase() === normalizedSymbol)
  return getApyFromBps(getEpochAprBps(match, globalData))
}

function getVeyfiMigratedBoostMultiplier(boostEpochs: number | null, currentEpoch: number | undefined): number {
  if (boostEpochs === null || currentEpoch === undefined) {
    return 1
  }

  const normalizedBoostEpochs = Math.max(0, Math.min(VEYFI_BOOST_EPOCHS, Math.floor(boostEpochs)))
  const normalizedCurrentEpoch = Math.max(0, Math.floor(currentEpoch))
  const remainingEpochs = normalizedBoostEpochs - normalizedCurrentEpoch

  return remainingEpochs > 0 ? 1 + remainingEpochs / VEYFI_BOOST_EPOCHS : 1
}

function deriveBaseAprFromEffective({
  boostMultiplier,
  effectiveApr,
  utilizationRatio
}: {
  boostMultiplier: number | null | undefined
  effectiveApr: number | null | undefined
  utilizationRatio: number | null | undefined
}): number | null {
  if (
    effectiveApr === null ||
    effectiveApr === undefined ||
    !Number.isFinite(effectiveApr) ||
    effectiveApr < 0 ||
    utilizationRatio === null ||
    utilizationRatio === undefined ||
    !Number.isFinite(utilizationRatio) ||
    utilizationRatio <= 0 ||
    boostMultiplier === null ||
    boostMultiplier === undefined ||
    !Number.isFinite(boostMultiplier) ||
    boostMultiplier <= 0
  ) {
    return null
  }

  return (effectiveApr * utilizationRatio) / boostMultiplier
}

function deriveCommonLlyfiBaseApr(globalData: TGovernanceGlobalData | null | undefined): number | null {
  const tokens = globalData?.global.veyfi?.tokens
  if (!tokens?.length || !globalData?.llyfi.length) {
    return null
  }

  const boostBps = toFiniteNumber(globalData.global.maxBoostBps)
  if (boostBps === null || boostBps <= 0) {
    return null
  }

  const boostMultiplier = boostBps / 10_000
  const capacities = new Map(
    tokens.map((token) => [token.symbol.toLowerCase(), toSafeBigInt(token.redemption.capacity)])
  )
  const baseAprs = globalData.llyfi.flatMap((token): number[] => {
    const capacity = capacities.get(token.symbol.toLowerCase())
    const staked = toSafeBigInt(token.staked)
    const unstaking = toSafeBigInt(token.unstaking)
    const effectiveApr = getApyFromBps(getEpochAprBps(token, globalData))
    if (!capacity || capacity <= 0n || staked === null || unstaking === null || effectiveApr === null) {
      return []
    }

    const utilizationRatio = Number(((staked + unstaking) * RATIO_SCALE) / capacity) / Number(RATIO_SCALE)
    const baseApr = deriveBaseAprFromEffective({ effectiveApr, utilizationRatio, boostMultiplier })
    return baseApr === null ? [] : [baseApr]
  })

  if (baseAprs.length === 0) {
    return null
  }

  const sortedBaseAprs = baseAprs.toSorted((a, b) => a - b)
  const middle = Math.floor(sortedBaseAprs.length / 2)
  return sortedBaseAprs.length % 2 === 1
    ? sortedBaseAprs[middle]
    : (sortedBaseAprs[middle - 1] + sortedBaseAprs[middle]) / 2
}

function getMigratedVeyfiApy(
  boostMultiplier: number,
  globalData: TGovernanceGlobalData | null | undefined
): number | null {
  const baseApr = deriveCommonLlyfiBaseApr(globalData) ?? getStyfiApy(globalData)
  return baseApr === null ? null : baseApr * boostMultiplier
}

function getStyfiTvlYfiRaw(globalData: TGovernanceGlobalData | null | undefined): bigint {
  return addOptionalRawValues(globalData?.styfi.staked, globalData?.styfi.unstaking)
}

function getStyfixTvlYfiRaw(globalData: TGovernanceGlobalData | null | undefined): bigint {
  return addOptionalRawValues(globalData?.styfix.staked, globalData?.styfix.unstaking)
}

function getMigratedVeyfiTvlYfiRaw(globalData: TGovernanceGlobalData | null | undefined): bigint {
  return toSafeBigInt(globalData?.global.veyfi?.migratedYfi) ?? 0n
}

function getLlyfiTvlYfiRaw(globalData: TGovernanceGlobalData | null | undefined, symbol: string): bigint {
  const match = globalData?.llyfi.find((entry) => entry.symbol.toLowerCase() === symbol.toLowerCase())
  return addOptionalRawValues(match?.staked, match?.unstaking)
}

function createPosition(params: {
  activeRaw: bigint
  amountRaw: bigint
  amountYfiRaw: bigint
  apy: number | null
  boostMultiplier?: number
  cooldown?: TGovernanceCooldown | null
  cooldownRaw: bigint
  href: string
  id: string
  kind: TGovernancePosition['kind']
  name: string
  subtitle: string
  symbol: string
  tokenAddress: TAddress
  unlockTime?: number
  valueUsd: number
  tvlUsd?: number
  tvlYfiRaw?: bigint
  walletRaw?: bigint
  withdrawableRaw: bigint
}): TGovernancePosition {
  const tvlYfiRaw = params.tvlYfiRaw ?? 0n
  return {
    id: params.id,
    kind: params.kind,
    name: params.name,
    symbol: params.symbol,
    subtitle: params.subtitle,
    href: params.href,
    tokenAddress: params.tokenAddress,
    amountRaw: params.amountRaw,
    amountNormalized: toNormalizedValue(params.amountRaw, 18),
    amountYfiRaw: params.amountYfiRaw,
    amountYfiNormalized: toNormalizedValue(params.amountYfiRaw, 18),
    activeRaw: params.activeRaw,
    cooldownRaw: params.cooldownRaw,
    withdrawableRaw: params.withdrawableRaw,
    walletRaw: params.walletRaw ?? 0n,
    valueUsd: params.valueUsd,
    tvlYfiRaw,
    tvlYfiNormalized: toNormalizedValue(tvlYfiRaw, 18),
    tvlUsd: params.tvlUsd ?? 0,
    apy: params.apy,
    unlockTime: params.unlockTime,
    boostMultiplier: params.boostMultiplier,
    cooldown: params.cooldown
  }
}

export function deriveGovernancePositions({
  raw,
  globalData,
  nowSeconds = Math.floor(Date.now() / 1000),
  yfiPrice
}: TDeriveGovernancePositionsParams): TGovernancePosition[] {
  if (!raw) {
    return []
  }

  const styfiStreamRemainingRaw =
    raw.styfi.styfiStream[1] > raw.styfi.styfiStream[2] ? raw.styfi.styfiStream[1] - raw.styfi.styfiStream[2] : 0n
  const styfixStreamRemainingRaw =
    raw.styfi.styfixStream[1] > raw.styfi.styfixStream[2] ? raw.styfi.styfixStream[1] - raw.styfi.styfixStream[2] : 0n
  const styfiWithdrawableRaw =
    raw.styfi.styfiWithdrawable < styfiStreamRemainingRaw ? raw.styfi.styfiWithdrawable : styfiStreamRemainingRaw
  const styfixWithdrawableRaw =
    raw.styfi.styfixWithdrawable < styfixStreamRemainingRaw ? raw.styfi.styfixWithdrawable : styfixStreamRemainingRaw
  const styfiCooldown = deriveCooldown(raw.styfi.styfiStream, raw.styfi.styfiWithdrawable, nowSeconds)
  const styfixCooldown = deriveCooldown(raw.styfi.styfixStream, raw.styfi.styfixWithdrawable, nowSeconds)
  const styfiCooldownRaw = styfiCooldown?.amountRaw ?? 0n
  const styfixCooldownRaw = styfixCooldown?.amountRaw ?? 0n
  const styfiTotalRaw = raw.styfi.styfiActive + styfiStreamRemainingRaw
  const styfixTotalRaw = raw.styfi.styfixActive + styfixStreamRemainingRaw
  const getYfiUsdValue = (amountRaw: bigint): number => toNormalizedValue(amountRaw, 18) * yfiPrice
  const styfiTvlYfiRaw = getStyfiTvlYfiRaw(globalData)
  const styfixTvlYfiRaw = getStyfixTvlYfiRaw(globalData)
  const styfiPositions = [
    styfiTotalRaw > 0n
      ? createPosition({
          id: 'governance-styfi',
          kind: 'styfi',
          name: 'Staked YFI',
          symbol: 'stYFI',
          subtitle: 'Governance staking',
          href: STYFI_URL,
          tokenAddress: STYFI_ADDRESS,
          amountRaw: styfiTotalRaw,
          amountYfiRaw: styfiTotalRaw,
          activeRaw: raw.styfi.styfiActive,
          cooldownRaw: styfiCooldownRaw,
          withdrawableRaw: styfiWithdrawableRaw,
          valueUsd: getYfiUsdValue(styfiTotalRaw),
          tvlYfiRaw: styfiTvlYfiRaw,
          tvlUsd: getYfiUsdValue(styfiTvlYfiRaw),
          apy: getStyfiApy(globalData),
          cooldown: styfiCooldown
        })
      : null,
    styfixTotalRaw > 0n
      ? createPosition({
          id: 'governance-styfix',
          kind: 'styfix',
          name: 'Delegated Staked YFI',
          symbol: 'stYFIx',
          subtitle: 'Passive governance staking',
          href: STYFI_URL,
          tokenAddress: STYFIX_ADDRESS,
          amountRaw: styfixTotalRaw,
          amountYfiRaw: styfixTotalRaw,
          activeRaw: raw.styfi.styfixActive,
          cooldownRaw: styfixCooldownRaw,
          withdrawableRaw: styfixWithdrawableRaw,
          valueUsd: getYfiUsdValue(styfixTotalRaw),
          tvlYfiRaw: styfixTvlYfiRaw,
          tvlUsd: getYfiUsdValue(styfixTvlYfiRaw),
          apy: getStyfixApy(globalData),
          cooldown: styfixCooldown
        })
      : null
  ].filter((position): position is TGovernancePosition => Boolean(position))
  const migratedVeyfiBoostMultiplier = getVeyfiMigratedBoostMultiplier(raw.veyfi.boostEpochs, globalData?.meta.epoch)
  const migratedVeyfi =
    raw.veyfi.migrated && raw.veyfi.lockedAmount > 0n
      ? [
          createPosition({
            id: 'governance-veyfi',
            kind: 'veyfi',
            name: 'Migrated veYFI',
            symbol: 'veYFI',
            subtitle: 'Migrated legacy lock',
            href: VEYFI_URL,
            tokenAddress: LEGACY_VEYFI_ADDRESS,
            amountRaw: raw.veyfi.lockedAmount,
            amountYfiRaw: raw.veyfi.lockedAmount,
            activeRaw: raw.veyfi.lockedAmount,
            cooldownRaw: 0n,
            withdrawableRaw: 0n,
            valueUsd: getYfiUsdValue(raw.veyfi.lockedAmount),
            tvlYfiRaw: getMigratedVeyfiTvlYfiRaw(globalData),
            tvlUsd: getYfiUsdValue(getMigratedVeyfiTvlYfiRaw(globalData)),
            apy: getMigratedVeyfiApy(migratedVeyfiBoostMultiplier, globalData),
            boostMultiplier: migratedVeyfiBoostMultiplier,
            unlockTime: raw.veyfi.unlockTime
          })
        ]
      : []

  const liquidLockerPositions = raw.liquidLockers
    .map((locker) => {
      const config = LIQUID_LOCKERS.find((item) => item.symbol === locker.symbol)
      const scale = config?.scale ?? locker.scale
      const streamRemainingShares = locker.stream[1] > locker.stream[2] ? locker.stream[1] - locker.stream[2] : 0n
      const streamRemainingRaw = streamRemainingShares * scale
      const withdrawableRaw = locker.withdrawable < streamRemainingRaw ? locker.withdrawable : streamRemainingRaw
      const cooldownRaw = streamRemainingRaw - withdrawableRaw
      const stakedRaw = locker.stakedShares * scale
      const amountRaw = locker.walletBalance + stakedRaw + streamRemainingRaw
      const amountYfiRaw = getLlyfiYfiEquivalentRaw(amountRaw, scale)
      const tvlYfiRaw = getLlyfiTvlYfiRaw(globalData, locker.symbol)
      if (amountRaw <= 0n) {
        return null
      }

      return createPosition({
        id: `governance-llyfi-${locker.symbol.toLowerCase()}`,
        kind: 'llyfi',
        name: `${locker.name} YFI`,
        symbol: locker.symbol,
        subtitle: 'Liquid locker',
        href: VEYFI_URL,
        tokenAddress: locker.tokenAddress,
        amountRaw,
        amountYfiRaw,
        activeRaw: stakedRaw,
        cooldownRaw,
        withdrawableRaw,
        walletRaw: locker.walletBalance,
        valueUsd: getYfiUsdValue(amountYfiRaw),
        tvlYfiRaw,
        tvlUsd: getYfiUsdValue(tvlYfiRaw),
        apy: getLlyfiApy(globalData, locker.symbol),
        cooldown: deriveCooldown(
          [locker.stream[0], locker.stream[1] * scale, locker.stream[2] * scale],
          withdrawableRaw,
          nowSeconds
        )
      })
    })
    .filter((position): position is TGovernancePosition => Boolean(position))

  return [...styfiPositions, ...liquidLockerPositions, ...migratedVeyfi].map((position) => ({
    ...position,
    tokenAddress: toAddress(position.tokenAddress)
  }))
}

export { ONE }
