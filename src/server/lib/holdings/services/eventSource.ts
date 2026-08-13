import type {
  HoldingsEventFetchType,
  HoldingsEventPaginationMode,
  VaultVersion
} from '@/server/lib/holdings/services/graphql'
import type { TSettledAddressScopedContext } from '@/server/lib/holdings/services/settledHoldingsContext'
import type { THoldingsValuationLoader } from '@/server/lib/holdings/services/valuationLoader'
import type { UserEvents } from '@/server/lib/holdings/types'

export interface THoldingsCachedTotal {
  readonly date: string
  readonly usdValue: number
  readonly isComplete?: boolean
}

export interface THoldingsCachedTotalsResult {
  readonly totals: readonly THoldingsCachedTotal[]
  readonly oldestUpdatedAt: Date | null
}

export interface THoldingsTotalsCache {
  readonly read: (startDate: string, endDate: string) => Promise<THoldingsCachedTotalsResult>
  readonly write: (totals: readonly THoldingsCachedTotal[]) => Promise<boolean>
}

export interface THoldingsEventSourceRequest {
  readonly userAddress: string
  readonly version: VaultVersion
  readonly maxTimestamp?: number
  readonly fetchType: HoldingsEventFetchType
  readonly paginationMode: HoldingsEventPaginationMode
}

export interface THoldingsEventSource {
  readonly key: string
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
  readonly hasActivity?: boolean
  readonly load: (request: THoldingsEventSourceRequest) => Promise<UserEvents>
}

export type THoldingsAggregationCacheMode = 'default' | 'bypass'
export type TProtocolReturnEventEnrichment = 'transaction' | 'address-only'

export interface THoldingsAggregationOptions {
  readonly eventSource?: THoldingsEventSource
  readonly cacheMode?: THoldingsAggregationCacheMode
  readonly totalsCache?: THoldingsTotalsCache
  readonly scheduleTotalsCacheWrite?: (persistence: Promise<boolean>) => void
  readonly valuationLoader?: THoldingsValuationLoader
  readonly settledContext?: Promise<TSettledAddressScopedContext>
  readonly protocolReturnEventEnrichment?: TProtocolReturnEventEnrichment
}

export function getHoldingsEventSourceKey(eventSource?: THoldingsEventSource): string {
  return eventSource
    ? JSON.stringify([eventSource.key, eventSource.latestSettledDayTimestamp, eventSource.eventUpperTimestamp])
    : 'legacy'
}
