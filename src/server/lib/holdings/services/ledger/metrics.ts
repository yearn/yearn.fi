import type { HoldingsLedgerMode } from '@/server/lib/holdings/config'
import {
  LEDGER_STREAMS,
  type TLedgerDirtyReasonCode,
  type TLedgerStream
} from '@/server/lib/holdings/services/ledger/types'

export type TLedgerMetricName =
  | 'ledger.codec'
  | 'ledger.lock'
  | 'ledger.manifest'
  | 'ledger.parity'
  | 'ledger.read'
  | 'ledger.recovery'
  | 'ledger.write'

export type TLedgerMetricOutcome =
  | 'success'
  | 'disabled'
  | 'lock-contention'
  | 'lock-lost'
  | 'head-conflict'
  | 'stale-writer'
  | 'corrupt'
  | 'oversized'
  | 'redis-fallback'
  | 'error'

export interface TLedgerMetric {
  name: TLedgerMetricName
  outcome: TLedgerMetricOutcome
  mode: HoldingsLedgerMode
  walletHash?: string
  durationMs?: number
  lockWaitMs?: number
  chunkCount?: number
  indexShardCount?: number
  recordCount?: number
  encodedBytes?: number
  manifestBytes?: number
  redisRequestCount?: number
  envioPages?: number
  envioRows?: number
  envioRequestCount?: number
  envioPresenceChainProbeCount?: number
  envioPresenceRequestCount?: number
  envioBatchedRequestCount?: number
  envioContinuationRequestCount?: number
  dirtyFromDate?: string
  dirtyReason?: TLedgerDirtyReasonCode
  syncReason?: 'bootstrap' | 'warm' | 'reconcile' | 'forced-reset'
  fallback?: 'previous-head' | 'legacy'
  parityReason?: 'event-mismatch'
  eventCounts?: Partial<
    Record<
      TLedgerStream,
      { readonly cached: number; readonly added: number; readonly replaced: number; readonly deleted: number }
    >
  >
}

export type TLedgerMetricLogger = (line: string) => void

const WALLET_HASH_PATTERN = /^[a-f0-9]{64}$/

function assertWalletHash(walletHash: string | undefined): void {
  if (walletHash !== undefined && !WALLET_HASH_PATTERN.test(walletHash)) {
    throw new Error('Ledger metrics require a lowercase SHA-256 wallet hash')
  }
}

function sanitizeEventCounts(eventCounts: TLedgerMetric['eventCounts']): TLedgerMetric['eventCounts'] {
  if (!eventCounts) {
    return undefined
  }
  return Object.fromEntries(
    LEDGER_STREAMS.flatMap((stream) => {
      const counts = eventCounts[stream]
      return counts
        ? [
            [
              stream,
              {
                cached: counts.cached,
                added: counts.added,
                replaced: counts.replaced,
                deleted: counts.deleted
              }
            ]
          ]
        : []
    })
  )
}

export function reportLedgerMetric(metric: TLedgerMetric, logger: TLedgerMetricLogger = console.info): void {
  assertWalletHash(metric.walletHash)
  logger(
    JSON.stringify({
      scope: 'holdings-ledger',
      name: metric.name,
      outcome: metric.outcome,
      mode: metric.mode,
      walletHash: metric.walletHash,
      durationMs: metric.durationMs,
      lockWaitMs: metric.lockWaitMs,
      chunkCount: metric.chunkCount,
      indexShardCount: metric.indexShardCount,
      recordCount: metric.recordCount,
      encodedBytes: metric.encodedBytes,
      manifestBytes: metric.manifestBytes,
      redisRequestCount: metric.redisRequestCount,
      envioPages: metric.envioPages,
      envioRows: metric.envioRows,
      envioRequestCount: metric.envioRequestCount,
      envioPresenceChainProbeCount: metric.envioPresenceChainProbeCount,
      envioPresenceRequestCount: metric.envioPresenceRequestCount,
      envioBatchedRequestCount: metric.envioBatchedRequestCount,
      envioContinuationRequestCount: metric.envioContinuationRequestCount,
      dirtyFromDate: metric.dirtyFromDate,
      dirtyReason: metric.dirtyReason,
      syncReason: metric.syncReason,
      fallback: metric.fallback,
      parityReason: metric.parityReason,
      eventCounts: sanitizeEventCounts(metric.eventCounts)
    })
  )
}
