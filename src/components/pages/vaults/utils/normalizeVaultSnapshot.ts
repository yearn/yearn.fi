import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TKongVaultSnapshot, TKongVaultSnapshotDebt } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { zeroAddress } from 'viem'

const RISK_SCORE_KEYS = [
  'review',
  'testing',
  'complexity',
  'riskExposure',
  'protocolIntegration',
  'centralizationRisk',
  'externalProtocolAudit',
  'externalProtocolCentralisation',
  'externalProtocolTvl',
  'externalProtocolLongevity',
  'externalProtocolType'
] as const

const normalizeNumber = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) {
    return fallback
  }
  const normalized = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  return normalized
}

const pickNonZeroNumber = (...values: Array<number | string | null | undefined>): number => {
  let fallback: number | undefined
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const normalized = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(normalized)) {
      continue
    }
    if (fallback === undefined) {
      fallback = normalized
    }
    if (normalized > 0) {
      return normalized
    }
  }
  return fallback ?? 0
}

const pickNonZeroBigNumberish = (...values: Array<string | number | null | undefined>): string => {
  let fallback: string | undefined
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const asString = String(value)
    if (!fallback) {
      fallback = asString
    }
    try {
      if (toBigInt(value) > 0n) {
        return asString
      }
    } catch {
      continue
    }
  }
  return fallback ?? '0'
}

const pickNumber = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

const normalizeFee = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0
  }
  if (value > 1) {
    return value / 10000
  }
  return value
}

const resolveDecimals = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 18
}

const normalizePricePerShare = (
  value: string | number | null | undefined,
  decimals: number,
  fallback?: number
): number => {
  if (value === null || value === undefined) {
    return fallback ?? 0
  }
  const normalized = toNormalizedBN(value, decimals).normalized
  if (normalized === 0 && typeof fallback === 'number' && fallback > 0) {
    return fallback
  }
  return normalized
}

type TSnapshotRiskScore = NonNullable<TKongVaultSnapshot['risk']>['riskScore']

const buildRiskScores = (riskScore: TSnapshotRiskScore | undefined, fallback?: number[]): number[] => {
  const scores = RISK_SCORE_KEYS.map((key) => normalizeNumber((riskScore as Record<string, number | null>)?.[key]))
  const hasSnapshotScores = scores.some((score) => score > 0)
  if (!hasSnapshotScores && fallback && fallback.length) {
    return fallback
  }
  return scores
}

const mapSnapshotDebts = (debts: TKongVaultSnapshotDebt[] = []): TYDaemonVaultStrategy[] => {
  return debts.map((debt, index) => {
    const debtRatio = pickNonZeroNumber(debt.debtRatio, debt.targetDebtRatio, debt.maxDebtRatio, 0)
    const totalDebt = pickNonZeroBigNumberish(debt.totalDebt, debt.currentDebt)
    const totalGain = debt.totalGain ?? '0'
    const totalLoss = debt.totalLoss ?? '0'
    const performanceFee = normalizeNumber(debt.performanceFee ?? 0)
    const lastReport = normalizeNumber(debt.lastReport ?? 0)
    const hasAllocation = toBigInt(totalDebt) > 0n || debtRatio > 0
    return {
      address: toAddress(debt.strategy),
      name: `Strategy ${index + 1}`,
      description: '',
      netAPR: 0,
      status: hasAllocation ? 'active' : 'not_active',
      details: {
        totalDebt,
        totalLoss,
        totalGain,
        performanceFee,
        lastReport,
        debtRatio
      }
    }
  })
}

const mergeStrategies = (
  baseStrategies: TYDaemonVault['strategies'] | null | undefined,
  debts: TKongVaultSnapshotDebt[] | undefined
): TYDaemonVaultStrategy[] => {
  if (!debts || debts.length === 0) {
    return (baseStrategies || []) as TYDaemonVaultStrategy[]
  }

  const debtMap = new Map(debts.map((debt) => [toAddress(debt.strategy), debt]))
  if (baseStrategies && baseStrategies.length > 0) {
    return (baseStrategies || []).map((strategy) => {
      const debt = debtMap.get(toAddress(strategy.address))
      if (!debt) return strategy
      if (!strategy.details) {
        return strategy
      }
      const debtRatio = pickNonZeroNumber(
        debt.debtRatio,
        debt.targetDebtRatio,
        debt.maxDebtRatio,
        strategy.details?.debtRatio,
        0
      )
      const totalDebt = pickNonZeroBigNumberish(debt.totalDebt, debt.currentDebt, strategy.details?.totalDebt)
      const totalGain = debt.totalGain ?? strategy.details?.totalGain ?? '0'
      const totalLoss = debt.totalLoss ?? strategy.details?.totalLoss ?? '0'
      const performanceFee = normalizeNumber(debt.performanceFee ?? strategy.details?.performanceFee ?? 0)
      const lastReport = normalizeNumber(debt.lastReport ?? strategy.details?.lastReport ?? 0)
      return {
        ...strategy,
        details: {
          ...strategy.details,
          totalDebt,
          totalGain,
          totalLoss,
          performanceFee,
          lastReport,
          debtRatio
        }
      }
    })
  }

  return mapSnapshotDebts(debts)
}

const computePrice = (totalAssets: string, decimals: number, tvlUsd: number, fallback?: number): number => {
  const normalizedAssets = toNormalizedBN(totalAssets, decimals).normalized
  if (!Number.isFinite(tvlUsd) || tvlUsd <= 0 || normalizedAssets <= 0) {
    return fallback ?? 0
  }
  return tvlUsd / normalizedAssets
}

const buildSnapshotVault = (snapshot: TKongVaultSnapshot, base?: TYDaemonVault): TYDaemonVault => {
  const metaToken = snapshot.meta?.token
  const tokenFallback = base?.token
  const token = {
    address: toAddress(metaToken?.address ?? snapshot.asset?.address ?? tokenFallback?.address ?? zeroAddress),
    name: metaToken?.name ?? snapshot.asset?.name ?? tokenFallback?.name ?? '',
    symbol: metaToken?.symbol ?? snapshot.asset?.symbol ?? tokenFallback?.symbol ?? '',
    description: metaToken?.description ?? tokenFallback?.description ?? '',
    decimals: resolveDecimals(metaToken?.decimals, snapshot.asset?.decimals, tokenFallback?.decimals)
  }

  const vaultDecimals = resolveDecimals(snapshot.decimals, base?.decimals, token.decimals)
  const totalAssets = snapshot.totalAssets ?? base?.tvl.totalAssets?.toString() ?? '0'
  const tvlUsd = pickNumber(snapshot.tvl?.close, base?.tvl.tvl, 0)
  const price = computePrice(totalAssets, token.decimals, tvlUsd, base?.tvl.price)

  const historical = snapshot.performance?.historical
  const netApr = pickNumber(snapshot.apy?.net, historical?.net, base?.apr.netAPR, 0)
  const weekNet = pickNumber(snapshot.apy?.weeklyNet, historical?.weeklyNet, base?.apr.points?.weekAgo, 0)
  const monthNet = pickNumber(snapshot.apy?.monthlyNet, historical?.monthlyNet, base?.apr.points?.monthAgo, 0)
  const inceptionNet = pickNumber(snapshot.apy?.inceptionNet, historical?.inceptionNet, base?.apr.points?.inception, 0)
  const forwardNet = pickNumber(snapshot.performance?.oracle?.apr, base?.apr.forwardAPR.netAPR, 0)

  const forwardType =
    snapshot.performance?.oracle?.apr !== null && snapshot.performance?.oracle?.apr !== undefined
      ? 'oracle'
      : (base?.apr.forwardAPR.type ?? 'unknown')

  const feesPerformance = snapshot.fees ? normalizeFee(snapshot.fees.performanceFee) : (base?.apr.fees.performance ?? 0)
  const feesManagement = snapshot.fees ? normalizeFee(snapshot.fees.managementFee) : (base?.apr.fees.management ?? 0)

  const pricePerShareToday = normalizePricePerShare(
    snapshot.apy?.pricePerShare,
    token.decimals,
    base?.apr.pricePerShare.today
  )
  const pricePerShareWeekly = normalizePricePerShare(
    snapshot.apy?.weeklyPricePerShare,
    token.decimals,
    base?.apr.pricePerShare.weekAgo
  )
  const pricePerShareMonthly = normalizePricePerShare(
    snapshot.apy?.monthlyPricePerShare,
    token.decimals,
    base?.apr.pricePerShare.monthAgo
  )

  const riskScore = buildRiskScores(snapshot.risk?.riskScore, base?.info.riskScore)
  const riskLevel = Math.max(0, normalizeNumber(snapshot.risk?.riskLevel, base?.info.riskLevel ?? 0))
  const riskScoreComment = snapshot.risk?.riskScore?.comment || base?.info.riskScoreComment || ''

  return yDaemonVaultSchema.parse({
    address: snapshot.address,
    version: snapshot.apiVersion ?? base?.version ?? '',
    type: snapshot.meta?.type ?? base?.type ?? 'Standard',
    kind: snapshot.meta?.kind ?? base?.kind ?? 'Legacy',
    symbol: snapshot.symbol || snapshot.meta?.displaySymbol || base?.symbol || '',
    name: snapshot.name || snapshot.meta?.name || snapshot.meta?.displayName || base?.name || '',
    description: snapshot.meta?.description ?? base?.description ?? '',
    category: snapshot.meta?.category ?? base?.category ?? '',
    decimals: vaultDecimals,
    chainID: snapshot.chainId,
    token,
    tvl: {
      totalAssets,
      tvl: tvlUsd,
      price
    },
    apr: {
      type: snapshot.apy?.label || base?.apr.type || 'unknown',
      netAPR: netApr,
      fees: {
        performance: feesPerformance,
        withdrawal: base?.apr.fees.withdrawal ?? 0,
        management: feesManagement
      },
      extra: base?.apr.extra ?? undefined,
      points: {
        weekAgo: weekNet,
        monthAgo: monthNet,
        inception: inceptionNet
      },
      pricePerShare: {
        today: pricePerShareToday,
        weekAgo: pricePerShareWeekly,
        monthAgo: pricePerShareMonthly
      },
      forwardAPR: {
        type: forwardType,
        netAPR: forwardNet,
        composite: base?.apr.forwardAPR.composite ?? undefined
      }
    },
    featuringScore: base?.featuringScore ?? 0,
    strategies: mergeStrategies(base?.strategies, snapshot.debts),
    staking: base?.staking ?? undefined,
    migration: {
      available: snapshot.meta?.migration?.available ?? base?.migration.available ?? false,
      address: snapshot.meta?.migration?.target ?? base?.migration.address ?? zeroAddress,
      contract: snapshot.meta?.migration?.contract ?? base?.migration.contract ?? zeroAddress
    },
    info: {
      sourceURL: snapshot.meta?.sourceURI ?? base?.info.sourceURL ?? '',
      riskLevel,
      riskScore,
      riskScoreComment,
      uiNotice: snapshot.meta?.uiNotice ?? base?.info.uiNotice ?? '',
      isRetired: snapshot.meta?.isRetired ?? base?.info.isRetired ?? false,
      isBoosted: snapshot.meta?.isBoosted ?? base?.info.isBoosted ?? false,
      isHighlighted: snapshot.meta?.isHighlighted ?? base?.info.isHighlighted ?? false,
      isHidden: snapshot.meta?.isHidden ?? base?.info.isHidden ?? false
    }
  })
}

export const mergeVaultSnapshot = (
  base: TYDaemonVault | undefined,
  snapshot: TKongVaultSnapshot | undefined
): TYDaemonVault | undefined => {
  if (!snapshot && base) return base
  if (!snapshot) return undefined

  if (!base) {
    return buildSnapshotVault(snapshot)
  }

  if (base.chainID !== snapshot.chainId) {
    return buildSnapshotVault(snapshot)
  }

  const merged = buildSnapshotVault(snapshot, base)
  return {
    ...base,
    ...merged,
    token: {
      ...merged.token,
      ...base.token
    },
    strategies: mergeStrategies(base.strategies, snapshot.debts),
    staking: base.staking,
    info: {
      ...base.info,
      ...merged.info,
      riskScore: merged.info.riskScore.length ? merged.info.riskScore : base.info.riskScore
    },
    migration: {
      ...base.migration,
      ...merged.migration
    },
    tvl: {
      ...merged.tvl,
      price: merged.tvl.price || base.tvl.price
    }
  }
}
