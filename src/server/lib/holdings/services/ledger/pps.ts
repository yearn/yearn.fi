import { createHash } from 'node:crypto'
import { debugError, debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import { fetchMultipleVaultsPPS, getPPS, type PPSTimeline } from '@/server/lib/holdings/services/kong'
import type {
  TProtocolReturnHistoricalPpsRequirement,
  TProtocolReturnHistoricalPpsValue
} from '@/server/lib/holdings/services/pnlSimple'
import {
  getHoldingsRedisClient,
  handleHoldingsRedisError,
  isHoldingsStorageEnabled
} from '@/server/lib/holdings/storage/redis'

const HISTORICAL_PPS_CACHE_PREFIX = 'holdings:ledger:historical-pps:v1'
const HISTORICAL_PPS_CACHE_TTL_SECONDS = 24 * 60 * 60
const CACHE_CONCURRENCY = 50

type TCachedHistoricalPps = {
  pricePerShare: number
  updatedAtMs: number
}

type TResolveHistoricalPpsOptions = {
  fetchPps?: typeof fetchMultipleVaultsPPS
  readCached?: (requirement: TProtocolReturnHistoricalPpsRequirement) => Promise<number | null>
  writeCached?: (requirement: TProtocolReturnHistoricalPpsRequirement, pricePerShare: number) => Promise<void>
}

export type TResolvedLedgerHistoricalPps = {
  values: TProtocolReturnHistoricalPpsValue[]
  cacheHits: number
  fetched: number
  missing: number
}

function chunkItems<TValue>(items: readonly TValue[], chunkSize: number): TValue[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function getCacheNamespaceSegment(): string {
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE?.trim()
  return namespace ? `:${namespace}` : ''
}

export function getLedgerHistoricalPpsCacheKey(requirement: TProtocolReturnHistoricalPpsRequirement): string {
  const identityHash = createHash('sha256').update(requirement.key).digest('hex')
  return `${HISTORICAL_PPS_CACHE_PREFIX}${getCacheNamespaceSegment()}:${requirement.chainId}:${requirement.vaultAddress.toLowerCase()}:${identityHash}`
}

function parseCachedHistoricalPps(value: unknown): number | null {
  const parsed = (() => {
    if (typeof value !== 'string') {
      return value
    }
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  })()

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const pricePerShare = Number((parsed as Partial<TCachedHistoricalPps>).pricePerShare)
  return Number.isFinite(pricePerShare) && pricePerShare > 0 ? pricePerShare : null
}

async function readCachedHistoricalPps(requirement: TProtocolReturnHistoricalPpsRequirement): Promise<number | null> {
  if (!isHoldingsStorageEnabled()) {
    return null
  }
  const redis = getHoldingsRedisClient()
  if (!redis) {
    return null
  }

  try {
    return parseCachedHistoricalPps(await redis.get<unknown>(getLedgerHistoricalPpsCacheKey(requirement)))
  } catch (error) {
    handleHoldingsRedisError('historical PPS cache read failed', error)
    return null
  }
}

async function writeCachedHistoricalPps(
  requirement: TProtocolReturnHistoricalPpsRequirement,
  pricePerShare: number
): Promise<void> {
  if (!isHoldingsStorageEnabled()) {
    return
  }
  const redis = getHoldingsRedisClient()
  if (!redis) {
    return
  }

  try {
    await redis.set(
      getLedgerHistoricalPpsCacheKey(requirement),
      JSON.stringify({ pricePerShare, updatedAtMs: Date.now() } satisfies TCachedHistoricalPps),
      { ex: HISTORICAL_PPS_CACHE_TTL_SECONDS }
    )
  } catch (error) {
    handleHoldingsRedisError('historical PPS cache write failed', error)
  }
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  mapper: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  return chunkItems(items, CACHE_CONCURRENCY).reduce<Promise<TOutput[]>>(async (resultsPromise, batch) => {
    const results = await resultsPromise
    return [...results, ...(await Promise.all(batch.map(mapper)))]
  }, Promise.resolve([]))
}

function getVaultKey(requirement: TProtocolReturnHistoricalPpsRequirement): string {
  return `${requirement.chainId}:${requirement.vaultAddress.toLowerCase()}`
}

export async function resolveLedgerHistoricalPps(
  requirements: readonly TProtocolReturnHistoricalPpsRequirement[],
  options: TResolveHistoricalPpsOptions = {}
): Promise<TResolvedLedgerHistoricalPps> {
  if (requirements.length === 0) {
    return { values: [], cacheHits: 0, fetched: 0, missing: 0 }
  }

  const getDurationMs = startHoldingsDebugTimer()
  const readCached = options.readCached ?? readCachedHistoricalPps
  const writeCached = options.writeCached ?? writeCachedHistoricalPps
  const fetchPps = options.fetchPps ?? fetchMultipleVaultsPPS
  const cachedValues = await mapWithConcurrency(requirements, async (requirement) => ({
    requirement,
    pricePerShare: await readCached(requirement)
  }))
  const hits = cachedValues.filter(
    (entry): entry is { requirement: TProtocolReturnHistoricalPpsRequirement; pricePerShare: number } =>
      entry.pricePerShare !== null
  )
  const missingRequirements = cachedValues.flatMap((entry) => (entry.pricePerShare === null ? [entry.requirement] : []))
  const uniqueMissingVaults = Array.from(
    missingRequirements
      .reduce<Map<string, { chainId: number; vaultAddress: string }>>((vaults, requirement) => {
        const key = getVaultKey(requirement)
        if (!vaults.has(key)) {
          vaults.set(key, { chainId: requirement.chainId, vaultAddress: requirement.vaultAddress })
        }
        return vaults
      }, new Map())
      .values()
  )

  const timelines = await (async (): Promise<Map<string, PPSTimeline>> => {
    if (uniqueMissingVaults.length === 0) {
      return new Map()
    }
    try {
      return await fetchPps(uniqueMissingVaults)
    } catch (error) {
      debugError('ledger-pps', 'targeted historical PPS fetch failed', error, {
        vaults: uniqueMissingVaults.length,
        requirements: missingRequirements.length
      })
      return new Map()
    }
  })()

  const fetchedValues = missingRequirements.flatMap((requirement) => {
    const timeline = timelines.get(getVaultKey(requirement))
    const pricePerShare = timeline ? getPPS(timeline, requirement.blockTimestamp) : null
    return pricePerShare !== null && Number.isFinite(pricePerShare) && pricePerShare > 0
      ? [{ requirement, pricePerShare }]
      : []
  })

  await mapWithConcurrency(fetchedValues, ({ requirement, pricePerShare }) => writeCached(requirement, pricePerShare))

  const values = [...hits, ...fetchedValues].map(({ requirement, pricePerShare }) => ({
    key: requirement.key,
    pricePerShare
  }))
  const missing = requirements.length - values.length

  debugLog('ledger-pps', 'resolved targeted historical PPS requirements', {
    durationMs: getDurationMs(),
    requirements: requirements.length,
    cacheHits: hits.length,
    fetched: fetchedValues.length,
    missing,
    vaultsFetched: uniqueMissingVaults.length
  })

  return {
    values,
    cacheHits: hits.length,
    fetched: fetchedValues.length,
    missing
  }
}
