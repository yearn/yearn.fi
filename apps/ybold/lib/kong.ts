import { ST_YBOLD, YBOLD } from '@ybold/lib/contracts'

const KONG_REST = 'https://kong.yearn.fi/api/rest'
const CACHE_SECONDS = 300
const SECONDS_PER_DAY = 24 * 60 * 60
const PPS_RETURN_WINDOW = 7 * SECONDS_PER_DAY
const MAX_PPS_BASELINE_DISTANCE = SECONDS_PER_DAY
const MAX_PPS_AGE = 2 * SECONDS_PER_DAY

type Numeric = number | string | null | undefined

type KongSnapshot = {
  address?: string
  chainId?: Numeric
  apy?: {
    weeklyNet?: Numeric
    monthlyNet?: Numeric
    inceptionNet?: Numeric
  }
  fees?: { performanceFee?: Numeric }
  tvl?: { close?: Numeric }
  performance?: {
    historical?: {
      weeklyNet?: Numeric
      monthlyNet?: Numeric
      inceptionNet?: Numeric
    }
  }
}

type KongTimeseriesPoint = {
  time?: Numeric
  component?: string
  value?: Numeric
}

export type VaultStats = {
  /** Annualized 7-day realized APY reported by Kong. */
  apy7d: number | null
  /** 30-day realized APY. */
  apy30d: number | null
  /** Since-inception APY. */
  apyInception: number | null
  /** Actual (non-annualized) return over the last 7 days. */
  ret7d: number | null
  /** Vault TVL in USD. */
  tvlUsd: number | null
  /** Performance fee as a fraction, e.g. 0.1 = 10%. */
  performanceFee: number | null
}

function toFiniteNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

function firstFiniteNumber(...values: Numeric[]): number | null {
  return values.map(toFiniteNumber).find((value) => value !== null) ?? null
}

async function fetchKong<T>(path: string): Promise<T> {
  const response = await fetch(`${KONG_REST}/${path}`, {
    next: { revalidate: CACHE_SECONDS }
  })
  if (!response.ok) throw new Error(`Kong request failed (${response.status})`)
  return (await response.json()) as T
}

function matchesVault(snapshot: KongSnapshot, address: string): boolean {
  return toFiniteNumber(snapshot.chainId) === 1 && snapshot.address?.toLowerCase() === address.toLowerCase()
}

function calculateSevenDayReturn(history: KongTimeseriesPoint[], now = Math.floor(Date.now() / 1000)): number | null {
  const points = history
    .filter((point) => point.component === 'humanized')
    .map((point) => ({
      time: toFiniteNumber(point.time),
      value: toFiniteNumber(point.value)
    }))
    .filter(
      (point): point is { time: number; value: number } =>
        point.time !== null && point.value !== null && point.value > 0
    )
    .toSorted((left, right) => left.time - right.time)

  const latest = points.at(-1)
  if (!latest || now - latest.time > MAX_PPS_AGE) return null

  const targetTime = latest.time - PPS_RETURN_WINDOW
  const baseline = points.filter((point) => point.time <= targetTime).at(-1)
  if (!baseline || targetTime - baseline.time > MAX_PPS_BASELINE_DISTANCE) return null

  return latest.value / baseline.value - 1
}

// APY and fee history accrues to st-yBOLD, while deposits and TVL are in yBOLD.
export async function getVaultStats(): Promise<VaultStats | null> {
  try {
    const [staked, vault, ppsHistory] = await Promise.all([
      fetchKong<KongSnapshot>(`snapshot/1/${ST_YBOLD}`),
      fetchKong<KongSnapshot>(`snapshot/1/${YBOLD}`),
      fetchKong<KongTimeseriesPoint[]>(`timeseries/pps/1/${ST_YBOLD}`).catch(() => [])
    ])

    if (!matchesVault(staked, ST_YBOLD) || !matchesVault(vault, YBOLD)) return null

    const performanceFeeBps = toFiniteNumber(staked.fees?.performanceFee)

    return {
      apy7d: firstFiniteNumber(staked.apy?.weeklyNet, staked.performance?.historical?.weeklyNet),
      apy30d: firstFiniteNumber(staked.apy?.monthlyNet, staked.performance?.historical?.monthlyNet),
      apyInception: firstFiniteNumber(staked.apy?.inceptionNet, staked.performance?.historical?.inceptionNet),
      ret7d: calculateSevenDayReturn(ppsHistory),
      tvlUsd: toFiniteNumber(vault.tvl?.close),
      performanceFee: performanceFeeBps === null ? null : performanceFeeBps / 10_000
    }
  } catch {
    return null
  }
}
