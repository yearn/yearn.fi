import type {
  HoldingsEventFetchType,
  HoldingsEventPaginationMode,
  VaultVersion
} from '@/server/lib/holdings/services/graphql'
import type { UserEvents } from '@/server/lib/holdings/types'

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
  readonly load: (request: THoldingsEventSourceRequest) => Promise<UserEvents>
}

export type THoldingsAggregationCacheMode = 'default' | 'bypass'
export type TProtocolReturnEventEnrichment = 'transaction' | 'address-only'

export interface THoldingsAggregationOptions {
  readonly eventSource?: THoldingsEventSource
  readonly cacheMode?: THoldingsAggregationCacheMode
  readonly protocolReturnEventEnrichment?: TProtocolReturnEventEnrichment
}

export function getHoldingsEventSourceKey(eventSource?: THoldingsEventSource): string {
  return eventSource
    ? JSON.stringify([eventSource.key, eventSource.latestSettledDayTimestamp, eventSource.eventUpperTimestamp])
    : 'legacy'
}
