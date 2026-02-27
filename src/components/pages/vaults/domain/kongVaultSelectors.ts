import { normalizeVaultCategory } from '@pages/vaults/utils/normalizeVaultCategory'
import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type {
  TKongVaultSnapshot,
  TKongVaultSnapshotComposition,
  TKongVaultSnapshotDebt,
  TKongVaultSnapshotStakingReward
} from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { zeroAddress } from 'viem'

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

const normalizeOptionalNumber = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined
  }
  const normalized = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(normalized)) {
    return undefined
  }
  return normalized
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

const pickNumber = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

const pickNumberOrNull = (...values: Array<number | string | null | undefined>): number | null => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const normalized = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(normalized)) {
      continue
    }
    return normalized
  }
  return null
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
    } catch {}
  }
  return fallback ?? '0'
}

const toBigIntValue = (value: string | number | bigint | null | undefined): bigint => {
  try {
    return toBigInt(value ?? 0)
  } catch {
    return 0n
  }
}

const computeDebtRatioFromCurrentDebt = (
  currentDebt: string | number | bigint | null | undefined,
  totalDebt: string | number | bigint | null | undefined
): number => {
  const debt = toBigIntValue(currentDebt)
  const total = toBigIntValue(totalDebt)
  if (debt <= 0n || total <= 0n) {
    return 0
  }
  return Number((debt * 10000n) / total)
}

const computeDebtRatioFromTotalAssets = (
  totalDebt: string | number | bigint | null | undefined,
  totalAssets: string | number | bigint | null | undefined
): number => {
  const debt = toBigIntValue(totalDebt)
  const assets = toBigIntValue(totalAssets)
  if (debt <= 0n || assets <= 0n) {
    return 0
  }
  return Number((debt * 10000n) / assets)
}

const normalizeCompositionStatus = (
  status: TKongVaultSnapshotComposition['status'],
  hasAllocation: boolean
): TKongVaultStrategy['status'] => {
  if (typeof status === 'string') {
    const normalized = status.toLowerCase().replace(/[\s-]+/g, '_')
    if (['active', 'enabled', 'live'].includes(normalized)) {
      return 'active'
    }
    if (['inactive', 'not_active', 'disabled', 'deprecated', 'retired', 'paused'].includes(normalized)) {
      return 'not_active'
    }
    if (['unallocated', 'idle', 'unfunded', 'no_debt'].includes(normalized)) {
      return 'unallocated'
    }
  }

  if (typeof status === 'number') {
    if (status === 1) {
      return 'active'
    }
    if (status <= 0) {
      return hasAllocation ? 'active' : 'unallocated'
    }
    return 'not_active'
  }

  return hasAllocation ? 'active' : 'unallocated'
}

type TRiskScorePayload = NonNullable<NonNullable<TKongVaultSnapshot['risk']>['riskScore']>

const buildRiskScores = (riskScore: TRiskScorePayload | undefined): number[] => {
  if (!riskScore || typeof riskScore !== 'object') {
    return []
  }

  return RISK_SCORE_KEYS.map((key) => normalizeNumber((riskScore as Record<string, number | null>)?.[key]))
}

const normalizePricePerShare = (value: string | number | null | undefined, decimals: number): number => {
  if (value === null || value === undefined) {
    return 0
  }
  return toNormalizedBN(value, decimals).normalized
}

const deriveDefaultCategory = ({
  name,
  symbol,
  tokenSymbol
}: {
  name: string
  symbol: string
  tokenSymbol: string
}): string => {
  const haystack = `${name} ${symbol} ${tokenSymbol}`.toUpperCase()
  const normalizedToken = tokenSymbol.toUpperCase()

  if (KNOWN_STABLECOIN_SYMBOLS.has(normalizedToken)) {
    return 'Stablecoin'
  }

  for (const stable of KNOWN_STABLECOIN_SYMBOLS) {
    if (haystack.includes(stable)) {
      return 'Stablecoin'
    }
  }

  return 'Volatile'
}

export type TKongVault = TKongVaultListItem

export type TKongVaultToken = {
  address: `0x${string}`
  name: string
  symbol: string
  description: string
  decimals: number
}

export type TKongVaultApr = {
  type: string
  netAPR: number
  fees: {
    performance: number
    withdrawal: number
    management: number
  }
  extra: {
    stakingRewardsAPR: number
    gammaRewardAPR: number
    katanaBonusAPY?: number
    katanaAppRewardsAPR?: number
    steerPointsPerDollar?: number
    fixedRateKatanaRewards?: number
  }
  points: {
    weekAgo: number
    monthAgo: number
    inception: number
  }
  pricePerShare: {
    today: number
    weekAgo: number
    monthAgo: number
  }
  forwardAPR: {
    type: string
    netAPR: number
    composite: {
      boost: number
      poolAPY: number
      boostedAPR: number
      baseAPR: number
      cvxAPR: number
      rewardsAPR: number
      v3OracleCurrentAPR: number
      v3OracleStratRatioAPR: number
      keepCRV: number
      keepVELO: number
      cvxKeepCRV: number
    }
  }
}

export type TKongVaultTvl = {
  totalAssets: bigint
  tvl: number
  price: number
}

export type TKongVaultStakingReward = {
  address: `0x${string}`
  name: string
  symbol: string
  decimals: number
  price: number
  isFinished: boolean
  finishedAt: number
  apr: number | null
  perWeek: number
}

export type TKongVaultStaking = {
  address: `0x${string}`
  available: boolean
  source: string
  rewards: TKongVaultStakingReward[]
}

export type TKongVaultMigration = {
  available: boolean
  address: `0x${string}`
  contract: `0x${string}`
}

export type TKongVaultInfo = {
  sourceURL: string
  riskLevel: number
  riskScore: number[]
  riskScoreComment: string
  uiNotice: string
  isRetired: boolean
  isBoosted: boolean
  isHighlighted: boolean
  isHidden: boolean
}

export type TKongVaultStrategy = {
  address: `0x${string}`
  name: string
  description: string
  netAPR: number | null
  estimatedAPY?: number
  status: 'active' | 'not_active' | 'unallocated'
  details?: {
    totalDebt: string
    totalLoss: string
    totalGain: string
    performanceFee: number
    lastReport: number
    debtRatio?: number
  }
}

export type TKongVaultView = {
  address: `0x${string}`
  version: string
  type: string
  kind: 'Legacy' | 'Multi Strategy' | 'Single Strategy'
  symbol: string
  name: string
  description: string
  category: string
  decimals: number
  chainID: number
  token: TKongVaultToken
  tvl: TKongVaultTvl
  apr: TKongVaultApr
  featuringScore: number
  strategies: TKongVaultStrategy[] | null
  staking: TKongVaultStaking
  migration: TKongVaultMigration
  info: TKongVaultInfo
}

export type TKongVaultInput = TKongVault | TKongVaultView

const isVaultView = (vault: TKongVaultInput): vault is TKongVaultView => 'chainID' in vault && 'version' in vault

export const getVaultAddress = (vault: TKongVaultInput): `0x${string}` =>
  isVaultView(vault) ? vault.address : toAddress(vault.address)

export const getVaultChainID = (vault: TKongVaultInput): number => (isVaultView(vault) ? vault.chainID : vault.chainId)

export const getVaultVersion = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.version
  }
  if (snapshot?.apiVersion) {
    return snapshot.apiVersion
  }
  if (vault.apiVersion) {
    return vault.apiVersion
  }
  return vault.v3 ? '3' : '2'
}

const KNOWN_KIND_VALUES = new Set(['Legacy', 'Multi Strategy', 'Single Strategy'])

export const getVaultKind = (
  vault: TKongVaultInput,
  snapshot?: TKongVaultSnapshot
): 'Legacy' | 'Multi Strategy' | 'Single Strategy' => {
  if (isVaultView(vault)) {
    return vault.kind
  }
  const raw = snapshot?.meta?.kind ?? vault.kind
  if (raw && KNOWN_KIND_VALUES.has(raw)) {
    return raw as 'Legacy' | 'Multi Strategy' | 'Single Strategy'
  }

  const version = getVaultVersion(vault, snapshot)
  const isV3 = version.startsWith('3') || version.startsWith('~3')
  if (isV3) {
    const strategiesCount = snapshot?.composition?.length ?? vault.strategiesCount
    return strategiesCount > 0 ? 'Multi Strategy' : 'Single Strategy'
  }
  return 'Legacy'
}

const KNOWN_TYPE_VALUES = new Set([
  'Automated',
  'Automated Yearn Vault',
  'Experimental',
  'Experimental Yearn Vault',
  'Standard',
  'Yearn Vault'
])

export const getVaultType = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.type
  }
  const raw = snapshot?.meta?.type ?? vault.type
  if (raw && KNOWN_TYPE_VALUES.has(raw)) {
    return raw
  }

  const name = (snapshot?.meta?.name ?? snapshot?.name ?? vault.name ?? '').toLowerCase()
  if (name.includes('factory')) {
    return 'Automated Yearn Vault'
  }

  return 'Standard'
}

export const isStandardVault = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): boolean => {
  const type = getVaultType(vault, snapshot)
  return type === 'Standard' || type === 'Yearn Vault'
}

export const isAutomatedVault = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): boolean => {
  const type = getVaultType(vault, snapshot)
  return type === 'Automated' || type === 'Automated Yearn Vault'
}

export const isExperimentalVault = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): boolean => {
  const type = getVaultType(vault, snapshot)
  return type === 'Experimental' || type === 'Experimental Yearn Vault'
}

export const getVaultName = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.name
  }
  return snapshot?.name || snapshot?.meta?.name || snapshot?.meta?.displayName || vault.name || ''
}

export const getVaultSymbol = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.symbol
  }
  return snapshot?.symbol || snapshot?.meta?.displaySymbol || vault.symbol || ''
}

export const getVaultDescription = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.description
  }
  return snapshot?.meta?.description ?? ''
}

export const getVaultToken = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultToken => {
  if (isVaultView(vault)) {
    return vault.token
  }
  const metaToken = snapshot?.meta?.token
  const snapshotAsset = snapshot?.asset
  const listAsset = vault.asset
  const symbol =
    metaToken?.symbol ||
    snapshotAsset?.symbol ||
    listAsset?.symbol ||
    vault.symbol ||
    snapshot?.symbol ||
    snapshot?.meta?.displaySymbol ||
    ''

  return {
    address: toAddress(metaToken?.address ?? snapshotAsset?.address ?? listAsset?.address ?? zeroAddress),
    name: metaToken?.name ?? snapshotAsset?.name ?? listAsset?.name ?? getVaultName(vault, snapshot),
    symbol,
    description: metaToken?.description ?? '',
    decimals: resolveDecimals(metaToken?.decimals, snapshotAsset?.decimals, listAsset?.decimals, vault.decimals)
  }
}

export const getVaultDecimals = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): number => {
  if (isVaultView(vault)) {
    return vault.decimals
  }
  const token = getVaultToken(vault, snapshot)
  return resolveDecimals(snapshot?.decimals, vault.decimals, token.decimals)
}

export const getVaultCategory = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): string => {
  if (isVaultView(vault)) {
    return vault.category
  }
  const normalized = normalizeVaultCategory(snapshot?.meta?.category ?? vault.category ?? '')
  if (normalized) {
    return normalized
  }

  const token = getVaultToken(vault, snapshot)
  return deriveDefaultCategory({
    name: getVaultName(vault, snapshot),
    symbol: getVaultSymbol(vault, snapshot),
    tokenSymbol: token.symbol
  })
}

export const getVaultTVL = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultTvl => {
  if (isVaultView(vault)) {
    return vault.tvl
  }
  const token = getVaultToken(vault, snapshot)
  const totalAssetsRaw = snapshot?.totalAssets ?? '0'
  const totalAssets = toBigIntValue(totalAssetsRaw)
  const tvl = pickNumber(snapshot?.tvl?.close ?? null, vault.tvl)
  const normalizedAssets = toNormalizedBN(totalAssets, token.decimals).normalized
  const price = Number.isFinite(tvl) && tvl > 0 && normalizedAssets > 0 ? tvl / normalizedAssets : 0

  return {
    totalAssets,
    tvl,
    price
  }
}

const mapEstimatedComposite = (
  vault: TKongVault,
  snapshot?: TKongVaultSnapshot
): TKongVaultApr['forwardAPR']['composite'] => {
  const snapshotComponents = snapshot?.performance?.estimated?.components
  const vaultComponents = vault.performance?.estimated?.components
  return {
    boost: normalizeNumber(snapshotComponents?.boost, normalizeNumber(vaultComponents?.boost)),
    poolAPY: normalizeNumber(snapshotComponents?.poolAPY, normalizeNumber(vaultComponents?.poolAPY)),
    boostedAPR: normalizeNumber(snapshotComponents?.boostedAPR, normalizeNumber(vaultComponents?.boostedAPR)),
    baseAPR: normalizeNumber(snapshotComponents?.baseAPR, normalizeNumber(vaultComponents?.baseAPR)),
    cvxAPR: normalizeNumber(snapshotComponents?.cvxAPR, normalizeNumber(vaultComponents?.cvxAPR)),
    rewardsAPR: normalizeNumber(snapshotComponents?.rewardsAPR, normalizeNumber(vaultComponents?.rewardsAPR)),
    v3OracleCurrentAPR: 0,
    v3OracleStratRatioAPR: 0,
    keepCRV: normalizeNumber(snapshotComponents?.keepCRV, normalizeNumber(vaultComponents?.keepCRV)),
    keepVELO: normalizeNumber(snapshotComponents?.keepVelo, normalizeNumber(vaultComponents?.keepVelo)),
    cvxKeepCRV: 0
  }
}

const mapExtraAPR = (vault: TKongVault, snapshot?: TKongVaultSnapshot): TKongVaultApr['extra'] => {
  const snapshotComponents = snapshot?.performance?.estimated?.components
  const vaultComponents = vault.performance?.estimated?.components
  const fixedRateKatanaRewards =
    normalizeOptionalNumber(snapshotComponents?.fixedRateKatanaRewards) ??
    normalizeOptionalNumber(snapshotComponents?.FixedRateKatanaRewards) ??
    normalizeOptionalNumber(vaultComponents?.fixedRateKatanaRewards) ??
    normalizeOptionalNumber(vaultComponents?.FixedRateKatanaRewards)

  return {
    stakingRewardsAPR: 0,
    gammaRewardAPR: 0,
    katanaBonusAPY:
      normalizeOptionalNumber(snapshotComponents?.katanaBonusAPY) ??
      normalizeOptionalNumber(vaultComponents?.katanaBonusAPY),
    katanaAppRewardsAPR:
      normalizeOptionalNumber(snapshotComponents?.katanaAppRewardsAPR) ??
      normalizeOptionalNumber(vaultComponents?.katanaAppRewardsAPR),
    steerPointsPerDollar:
      normalizeOptionalNumber(snapshotComponents?.steerPointsPerDollar) ??
      normalizeOptionalNumber(vaultComponents?.steerPointsPerDollar),
    fixedRateKatanaRewards
  }
}

export const getVaultAPR = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultApr => {
  if (isVaultView(vault)) {
    return vault.apr
  }
  const token = getVaultToken(vault, snapshot)
  const historical = snapshot?.performance?.historical ?? vault.performance?.historical
  const oracle = snapshot?.performance?.oracle ?? vault.performance?.oracle
  const estimated = snapshot?.performance?.estimated ?? vault.performance?.estimated
  const isKatanaVault = getVaultChainID(vault) === 747474

  const forwardNet = isKatanaVault
    ? pickNumber(
        snapshot?.performance?.oracle?.apy,
        snapshot?.performance?.oracle?.apr,
        vault.performance?.oracle?.apy,
        snapshot?.performance?.estimated?.apy,
        snapshot?.performance?.estimated?.apr,
        vault.performance?.estimated?.apy,
        vault.performance?.historical?.net,
        historical?.net
      )
    : pickNumber(
        snapshot?.performance?.estimated?.apy,
        snapshot?.performance?.estimated?.apr,
        snapshot?.performance?.oracle?.apy,
        snapshot?.performance?.oracle?.apr,
        vault.performance?.oracle?.apy,
        vault.performance?.estimated?.apy,
        vault.performance?.historical?.net,
        historical?.net
      )

  const forwardType = snapshot?.performance?.estimated
    ? 'estimated'
    : snapshot?.performance?.oracle?.apr !== null && snapshot?.performance?.oracle?.apr !== undefined
      ? 'oracle'
      : oracle?.apy !== null && oracle?.apy !== undefined
        ? 'oracle'
        : (estimated?.type ?? '')

  return {
    type:
      snapshot?.apy?.label ||
      estimated?.type ||
      (oracle?.apy !== null && oracle?.apy !== undefined ? 'oracle' : 'unknown'),
    netAPR: pickNumber(snapshot?.apy?.net ?? null, historical?.net),
    fees: {
      performance: normalizeFee(snapshot?.fees?.performanceFee ?? vault.fees?.performanceFee),
      withdrawal: 0,
      management: normalizeFee(snapshot?.fees?.managementFee ?? vault.fees?.managementFee)
    },
    extra: mapExtraAPR(vault, snapshot),
    points: {
      weekAgo: pickNumber(snapshot?.apy?.weeklyNet ?? null, historical?.weeklyNet),
      monthAgo: pickNumber(snapshot?.apy?.monthlyNet ?? null, historical?.monthlyNet),
      inception: pickNumber(snapshot?.apy?.inceptionNet ?? null, historical?.inceptionNet)
    },
    pricePerShare: {
      today: normalizePricePerShare(snapshot?.apy?.pricePerShare, token.decimals),
      weekAgo: normalizePricePerShare(snapshot?.apy?.weeklyPricePerShare, token.decimals),
      monthAgo: normalizePricePerShare(snapshot?.apy?.monthlyPricePerShare, token.decimals)
    },
    forwardAPR: {
      type: forwardType,
      netAPR: forwardNet,
      composite: mapEstimatedComposite(vault, snapshot)
    }
  }
}

const mapSnapshotStakingRewards = (
  rewards: TKongVaultSnapshotStakingReward[] | undefined
): TKongVaultStakingReward[] => {
  if (!rewards || rewards.length === 0) {
    return []
  }

  return rewards.map((reward) => ({
    address: toAddress(reward.address ?? zeroAddress),
    name: reward.name ?? '',
    symbol: reward.symbol ?? '',
    decimals: resolveDecimals(reward.decimals ?? null),
    price: normalizeNumber(reward.price ?? 0),
    isFinished: Boolean(reward.isFinished),
    finishedAt: normalizeNumber(reward.finishedAt ?? 0),
    apr: reward.apr === null || reward.apr === undefined || Number.isNaN(reward.apr) ? null : reward.apr,
    perWeek: normalizeNumber(reward.perWeek ?? 0)
  }))
}

export const getVaultStaking = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultStaking => {
  if (isVaultView(vault)) {
    return vault.staking
  }
  const snapshotStaking = snapshot?.staking
  const listStaking = vault.staking

  return {
    address: toAddress(snapshotStaking?.address ?? listStaking?.address ?? zeroAddress),
    available: Boolean(snapshotStaking?.available ?? listStaking?.available ?? false),
    source: snapshotStaking?.source ?? '',
    rewards: mapSnapshotStakingRewards(snapshotStaking?.rewards)
  }
}

export const getVaultMigration = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultMigration => {
  if (isVaultView(vault)) {
    return vault.migration
  }
  return {
    available: Boolean(snapshot?.meta?.migration?.available ?? vault.migration ?? false),
    address: toAddress(snapshot?.meta?.migration?.target ?? zeroAddress),
    contract: toAddress(snapshot?.meta?.migration?.contract ?? zeroAddress)
  }
}

export const getVaultInfo = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultInfo => {
  if (isVaultView(vault)) {
    return vault.info
  }
  const riskScore = buildRiskScores(snapshot?.risk?.riskScore)

  return {
    sourceURL: snapshot?.meta?.sourceURI ?? '',
    riskLevel: normalizeNumber(snapshot?.risk?.riskLevel, vault.riskLevel ?? -1),
    riskScore,
    riskScoreComment: snapshot?.risk?.riskScore?.comment ?? '',
    uiNotice: snapshot?.meta?.uiNotice ?? '',
    isRetired: Boolean(snapshot?.meta?.isRetired ?? vault.isRetired),
    isBoosted: Boolean(snapshot?.meta?.isBoosted ?? vault.isBoosted),
    isHighlighted: Boolean(snapshot?.meta?.isHighlighted ?? vault.isHighlighted),
    isHidden: Boolean(snapshot?.meta?.isHidden ?? vault.isHidden)
  }
}

const mapSnapshotComposition = (
  composition: TKongVaultSnapshotComposition[] | undefined,
  totalAssetsForRatios: bigint
): TKongVaultStrategy[] => {
  if (!composition || composition.length === 0) {
    return []
  }

  const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
  const nowSeconds = Math.floor(Date.now() / 1000)
  const strategies: TKongVaultStrategy[] = []

  composition.forEach((entry, index) => {
    const resolvedAddress = toAddress(entry.address ?? entry.strategy)
    if (resolvedAddress === zeroAddress) {
      return
    }

    const totalDebt = pickNonZeroBigNumberish(entry.totalDebt, entry.currentDebt, '0')
    const computedDebtRatio = computeDebtRatioFromTotalAssets(totalDebt, totalAssetsForRatios)
    const debtRatio = normalizeNumber(entry.debtRatio ?? computedDebtRatio, computedDebtRatio)
    const totalGain = entry.totalGain ?? '0'
    const totalLoss = entry.totalLoss ?? '0'
    const performanceFee = normalizeNumber(entry.performanceFee ?? 0)
    const lastReport = normalizeNumber(entry.lastReport ?? 0)
    const lastReportSeconds = lastReport > 1_000_000_000_000 ? Math.floor(lastReport / 1000) : lastReport
    const hasAllocation = toBigInt(totalDebt) > 0n || debtRatio > 0
    const shouldUseLatestReportApr =
      hasAllocation && lastReportSeconds > 0 && nowSeconds - lastReportSeconds <= ONE_WEEK_IN_SECONDS
    const status = normalizeCompositionStatus(entry.status, hasAllocation)
    const name = entry.name?.trim() || `Strategy ${index + 1}`
    const estimatedAPY = (() => {
      const oracleApy = pickNumberOrNull(entry.performance?.oracle?.apy)
      if (oracleApy !== null) {
        return oracleApy
      }
      const estimatedApy = pickNumberOrNull(entry.performance?.estimated?.apy)
      return estimatedApy === null ? undefined : estimatedApy
    })()
    const resolvedApr = hasAllocation
      ? pickNumberOrNull(
          entry.performance?.historical?.net,
          shouldUseLatestReportApr ? entry.latestReportApr : undefined
        )
      : null

    strategies.push({
      address: resolvedAddress,
      name,
      description: '',
      netAPR: resolvedApr,
      estimatedAPY,
      status,
      details: {
        totalDebt,
        totalLoss,
        totalGain,
        performanceFee,
        lastReport,
        debtRatio
      }
    })
  })

  return strategies
}

const mapSnapshotDebts = (debts: TKongVaultSnapshotDebt[] = [], totalDebtForRatios?: string): TKongVaultStrategy[] => {
  return debts.map((debt, index) => {
    const debtAmount = pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt)
    const computedDebtRatio = computeDebtRatioFromCurrentDebt(debtAmount, totalDebtForRatios)
    const debtRatio = pickNumber(debt.debtRatio ?? null, computedDebtRatio)
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
      netAPR: null,
      status: hasAllocation ? 'active' : 'unallocated',
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

const resolveTotalAssetsForRatios = (snapshot?: TKongVaultSnapshot): bigint => {
  const snapshotAssets = toBigIntValue(snapshot?.totalAssets)
  if (snapshotAssets > 0n) {
    return snapshotAssets
  }

  const debts = snapshot?.debts || []
  let summedDebt = 0n
  for (const debt of debts) {
    summedDebt += toBigIntValue(pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt, '0'))
  }

  if (summedDebt > 0n) {
    return summedDebt
  }

  return 0n
}

const resolveTotalDebtForRatios = (snapshot?: TKongVaultSnapshot): string => {
  const snapshotTotalDebt = toBigIntValue(snapshot?.totalDebt)
  if (snapshotTotalDebt > 0n) {
    return snapshotTotalDebt.toString()
  }

  const debts = snapshot?.debts || []
  let summedDebt = 0n
  for (const debt of debts) {
    summedDebt += toBigIntValue(pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt, '0'))
  }

  if (summedDebt > 0n) {
    return summedDebt.toString()
  }

  return '0'
}

export const getVaultStrategies = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultStrategy[] => {
  if (isVaultView(vault)) {
    return vault.strategies ?? []
  }
  if (!snapshot) {
    return []
  }

  const totalAssetsForRatios = resolveTotalAssetsForRatios(snapshot)
  const fromComposition = mapSnapshotComposition(snapshot.composition, totalAssetsForRatios)
  if (fromComposition.length > 0) {
    return fromComposition
  }

  return mapSnapshotDebts(snapshot.debts, resolveTotalDebtForRatios(snapshot))
}

export const getVaultFeaturingScore = (vault: TKongVaultInput): number =>
  isVaultView(vault) ? vault.featuringScore : 0

export const getVaultView = (vault: TKongVaultInput, snapshot?: TKongVaultSnapshot): TKongVaultView => {
  if (isVaultView(vault)) {
    return vault
  }

  return {
    address: getVaultAddress(vault),
    version: getVaultVersion(vault, snapshot),
    type: getVaultType(vault, snapshot),
    kind: getVaultKind(vault, snapshot),
    symbol: getVaultSymbol(vault, snapshot),
    name: getVaultName(vault, snapshot),
    description: getVaultDescription(vault, snapshot),
    category: getVaultCategory(vault, snapshot),
    decimals: getVaultDecimals(vault, snapshot),
    chainID: getVaultChainID(vault),
    token: getVaultToken(vault, snapshot),
    tvl: getVaultTVL(vault, snapshot),
    apr: getVaultAPR(vault, snapshot),
    featuringScore: getVaultFeaturingScore(vault),
    strategies: getVaultStrategies(vault, snapshot),
    staking: getVaultStaking(vault, snapshot),
    migration: getVaultMigration(vault, snapshot),
    info: getVaultInfo(vault, snapshot)
  }
}

export const getVaultKey = (vault: TKongVaultInput): string =>
  `${getVaultChainID(vault)}_${toAddress(getVaultAddress(vault))}`
