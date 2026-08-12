import type { TEnvioLedgerFetchStrategy } from '@/server/lib/holdings/services/ledger/envio'
import type {
  TLedgerSixStreams,
  TLedgerStream,
  TLedgerSyncReasonCode
} from '@/server/lib/holdings/services/ledger/types'

export const WALLET_LEDGER_SCHEMA_VERSION = 3 as const
export const WALLET_LEDGER_CODEC = 'brotli-q4-base64' as const
export const WALLET_LEDGER_FRESHNESS_MS = 5 * 60 * 1000
export const WALLET_LEDGER_EMPTY_TTL_MS = 24 * 60 * 60 * 1000
export const WALLET_LEDGER_LOCK_TTL_MS = 5 * 60 * 1000
export const WALLET_LEDGER_LOCK_HEARTBEAT_MS = 60 * 1000
export const WALLET_LEDGER_MAX_ENCODED_BYTES = 4 * 1024 * 1024
export const WALLET_LEDGER_MAX_DECODED_BYTES = 32 * 1024 * 1024

export interface TWalletLedgerCoverageV1 {
  readonly chainId: number
  readonly startBlock: number
  readonly endBlock: number | null
  readonly completeThroughBlock: number
}

export interface TWalletLedgerPayloadV3 {
  readonly schemaVersion: typeof WALLET_LEDGER_SCHEMA_VERSION
  readonly calculationVersion: string
  readonly walletHash: string
  readonly sourceFingerprint: string
  readonly sourceGeneration: number
  readonly appliedInvalidationSequence: number
  readonly coverage: readonly TWalletLedgerCoverageV1[]
  readonly streams: TLedgerSixStreams
  readonly createdAtMs: number
  readonly updatedAtMs: number
  readonly reconciledAtMs: number
}

export interface TWalletLedgerState extends TWalletLedgerPayloadV3 {
  readonly revision: string
  readonly eventRevision: string
  readonly encodedBytes: number
  readonly decodedBytes: number
}

export type TWalletLedgerReadResult =
  | { readonly status: 'missing' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'ready'; readonly ledger: TWalletLedgerState }

export type TWalletLedgerSyncType = 'fresh' | 'bootstrap' | 'warm' | 'reconcile' | 'forced-reset' | 'source-reset'
export type TWalletLedgerSyncOutcome = 'fresh' | 'unchanged' | 'updated'

export interface TWalletLedgerEventStats {
  readonly cached: number
  readonly fetched: number
  readonly added: number
  readonly replaced: number
  readonly deleted: number
  readonly total: number
}

export interface TWalletLedgerEnvioStats {
  readonly pages: number
  readonly rows: number
  readonly requests: number
  readonly strategy: TEnvioLedgerFetchStrategy | 'none'
}

export interface TWalletLedgerCompletedSyncResult {
  readonly status: 'ready'
  readonly outcome: TWalletLedgerSyncOutcome
  readonly syncType: TWalletLedgerSyncType
  readonly ledger: TWalletLedgerState
  readonly events: TWalletLedgerEventStats
  readonly streams: Readonly<
    Record<
      TLedgerStream,
      {
        readonly cached: number
        readonly fetched: number
        readonly added: number
        readonly replaced: number
        readonly deleted: number
        readonly total: number
      }
    >
  >
  readonly envio: TWalletLedgerEnvioStats
  readonly transition: {
    readonly previousEventRevision: string | null
    readonly previousAppliedInvalidationSequence: number | null
    readonly dirtyFromTimestamp: number | null
  }
  readonly durationMs: number
}

export type TWalletLedgerBusySyncResult = {
  readonly status: 'syncing'
  readonly reasonCode: 'lock_busy'
}

export type TWalletLedgerSyncResult = TWalletLedgerCompletedSyncResult | TWalletLedgerBusySyncResult

export type TWithSynchronizedWalletLedgerResult<TConsumed> =
  | { readonly kind: 'busy'; readonly sync: TWalletLedgerBusySyncResult }
  | { readonly kind: 'completed'; readonly sync: TWalletLedgerCompletedSyncResult; readonly consumed: TConsumed }

export type TWalletLedgerErrorReason =
  | Extract<TLedgerSyncReasonCode, 'upstream_failed' | 'storage_failed' | 'decode_failed'>
  | 'stale_lock'
  | 'source_lagging'

export class WalletLedgerError extends Error {
  readonly reasonCode: TWalletLedgerErrorReason
  readonly statusCode: number

  constructor(reasonCode: TWalletLedgerErrorReason, statusCode: number) {
    super('Wallet holdings ledger operation failed')
    this.name = 'WalletLedgerError'
    this.reasonCode = reasonCode
    this.statusCode = statusCode
  }
}
