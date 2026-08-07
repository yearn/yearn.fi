import { fetchHistoricalStrategyUniverse } from './envio'
import { fetchVaultOnChainStatesAtTimestamps } from './rpc'
import { fetchCurrentStrategyMetadata, type StrategyNameSource } from './strategyMetadata'

export interface HistoricalAllocationStrategy {
  address: string
  name: string | null
  nameSource: StrategyNameSource | null
  currentBps: number
}

export interface HistoricalAllocationSnapshot {
  timestampUtc: string
  blockNumber: number
  blockTimestampUtc: string
  source: 'archive-rpc'
  strategyUniverseSource: 'envio-strategy-changed'
  complete: true
  strategies: HistoricalAllocationStrategy[]
  unallocatedBps: number
  unallocatedSource: 'same-timestamp-onchain'
}

export interface HistoricalAllocationRequest {
  chainId: number
  vault: string
  timestampUtc: string
  optimizerStrategies: Array<{ strategy: string; name?: string }>
}

const HISTORICAL_ALLOCATION_CACHE_TTL_MS = 10 * 60 * 1000
const historicalAllocationCache = new Map<
  string,
  { expiresAt: number; value: Promise<HistoricalAllocationSnapshot | null> }
>()

function requestKey(request: HistoricalAllocationRequest): string {
  const optimizerScopeKey = Array.from(
    new Set(request.optimizerStrategies.map((strategy) => strategy.strategy.toLowerCase()))
  )
    .sort()
    .join(',')
  return `${request.chainId}:${request.vault.toLowerCase()}:${request.timestampUtc}:${optimizerScopeKey}`
}

function parseTimestampUtc(timestampUtc: string): number | null {
  const milliseconds = new Date(timestampUtc.replace(' UTC', 'Z').replace(' ', 'T')).getTime()
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null
}

function formatTimestampUtc(timestamp: number): string {
  return `${new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

function calculateBps(amount: bigint, totalAssets: bigint): number {
  return totalAssets > 0n ? Number((amount * 10000n + totalAssets / 2n) / totalAssets) : 0
}

function buildHistoricalStrategies(
  strategyAddresses: readonly string[],
  strategyDebts: Map<string, bigint>,
  totalAssets: bigint,
  currentMetadata: Awaited<ReturnType<typeof fetchCurrentStrategyMetadata>>
): HistoricalAllocationStrategy[] {
  return strategyAddresses
    .map((address) => {
      const normalizedAddress = address.toLowerCase()
      const debt = strategyDebts.get(normalizedAddress) ?? 0n
      const catalogMetadata = currentMetadata.get(normalizedAddress)

      return {
        address,
        name: catalogMetadata?.name ?? null,
        nameSource: catalogMetadata?.source ?? null,
        currentBps: calculateBps(debt, totalAssets),
        hasDebt: debt > 0n
      }
    })
    .filter((strategy) => strategy.hasDebt)
    .map(({ hasDebt: _hasDebt, ...strategy }) => strategy)
}

export async function fetchHistoricalAllocationGroup(
  requests: readonly HistoricalAllocationRequest[]
): Promise<Map<string, HistoricalAllocationSnapshot | null>> {
  const firstRequest = requests[0]
  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!firstRequest || !envioUrl) {
    return new Map(requests.map((request) => [requestKey(request), null]))
  }

  const parsedRequests = requests.map((request) => ({
    request,
    timestamp: parseTimestampUtc(request.timestampUtc)
  }))
  const validParsedRequests = parsedRequests.filter(
    (item): item is { request: HistoricalAllocationRequest; timestamp: number } => item.timestamp !== null
  )
  if (validParsedRequests.length === 0) {
    return new Map(requests.map((request) => [requestKey(request), null]))
  }

  const latestTimestamp = Math.max(...validParsedRequests.map((item) => item.timestamp))
  const universe = await fetchHistoricalStrategyUniverse(
    envioUrl,
    firstRequest.vault,
    firstRequest.chainId,
    latestTimestamp,
    []
  )
  if (!universe.complete) {
    return new Map(requests.map((request) => [requestKey(request), null]))
  }

  const reconstructableRequests = validParsedRequests.filter(({ request, timestamp }) =>
    request.optimizerStrategies.every((strategy) => {
      const firstSeenTimestamp = universe.firstSeenTimestampByAddress[strategy.strategy.toLowerCase()]
      return firstSeenTimestamp !== undefined && firstSeenTimestamp <= timestamp
    })
  )
  const uniqueReconstructableRequests = Array.from(
    new Map(reconstructableRequests.map((item) => [item.request.timestampUtc, item])).values()
  )
  const [states, currentMetadata] = await Promise.all([
    fetchVaultOnChainStatesAtTimestamps(
      firstRequest.chainId,
      firstRequest.vault,
      uniqueReconstructableRequests.map((item) => ({
        timestamp: item.timestamp,
        strategyAddresses: universe.strategyAddresses
      }))
    ),
    fetchCurrentStrategyMetadata(firstRequest.chainId, firstRequest.vault).catch(() => new Map())
  ])
  const snapshotByTimestamp = new Map(
    uniqueReconstructableRequests.map((item, index) => {
      const state = states[index]
      const snapshot: HistoricalAllocationSnapshot | null =
        state && state.totalAssets > 0n
          ? {
              timestampUtc: item.request.timestampUtc,
              blockNumber: state.blockNumber,
              blockTimestampUtc: formatTimestampUtc(state.blockTimestamp),
              source: 'archive-rpc',
              strategyUniverseSource: universe.source,
              complete: true,
              strategies: buildHistoricalStrategies(
                universe.strategyAddresses,
                state.strategyDebts,
                state.totalAssets,
                currentMetadata
              ),
              unallocatedBps: state.unallocatedBps,
              unallocatedSource: 'same-timestamp-onchain'
            }
          : null
      return [item.request.timestampUtc, snapshot] as const
    })
  )

  return new Map(
    requests.map((request) => [requestKey(request), snapshotByTimestamp.get(request.timestampUtc) ?? null])
  )
}

export async function getHistoricalAllocationSnapshot(
  request: HistoricalAllocationRequest
): Promise<HistoricalAllocationSnapshot | null> {
  const snapshots = await getHistoricalAllocationSnapshots([request])
  return snapshots.get(requestKey(request)) ?? null
}

export async function getHistoricalAllocationSnapshots(
  requests: readonly HistoricalAllocationRequest[]
): Promise<Map<string, HistoricalAllocationSnapshot | null>> {
  const cachedSnapshots = requests.reduce((snapshots, request) => {
    const key = requestKey(request)
    const cached = historicalAllocationCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      snapshots.set(key, cached.value)
    }
    return snapshots
  }, new Map<string, Promise<HistoricalAllocationSnapshot | null>>())
  const uncachedRequests = requests.filter((request) => !cachedSnapshots.has(requestKey(request)))
  const vaultRequestGroups = Array.from(
    uncachedRequests
      .reduce((groups, request) => {
        const groupKey = `${request.chainId}:${request.vault.toLowerCase()}`
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), request])
        return groups
      }, new Map<string, HistoricalAllocationRequest[]>())
      .values()
  )
  const requestGroups = vaultRequestGroups.flatMap((group) =>
    Array.from({ length: Math.ceil(group.length / 20) }, (_value, index) => group.slice(index * 20, index * 20 + 20))
  )
  const fetchedGroups = await requestGroups.reduce<Promise<Array<Map<string, HistoricalAllocationSnapshot | null>>>>(
    async (allGroupsPromise, group) => {
      const allGroups = await allGroupsPromise
      const fetchedGroup = await fetchHistoricalAllocationGroup(group).catch(
        () => new Map(group.map((request) => [requestKey(request), null]))
      )
      return [...allGroups, fetchedGroup]
    },
    Promise.resolve([])
  )
  const fetchedSnapshots = new Map(fetchedGroups.flatMap((group) => Array.from(group.entries())))
  fetchedSnapshots.forEach((snapshot, key) => {
    const value = Promise.resolve(snapshot)
    historicalAllocationCache.set(key, {
      expiresAt: Date.now() + HISTORICAL_ALLOCATION_CACHE_TTL_MS,
      value
    })
    cachedSnapshots.set(key, value)
  })

  const resolvedSnapshots = await Promise.all(
    requests.map(async (request) => {
      const key = requestKey(request)
      return [key, (await cachedSnapshots.get(key)) ?? null] as const
    })
  )
  return new Map(resolvedSnapshots)
}

export function getHistoricalAllocationRequestKey(request: HistoricalAllocationRequest): string {
  return requestKey(request)
}
