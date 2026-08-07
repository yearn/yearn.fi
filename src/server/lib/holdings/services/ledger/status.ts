import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import {
  readLedgerSyncStatus,
  readVerifiedLedgerRevision,
  type TLedgerRevisionReadResult,
  type TLedgerSyncStatusReadResult
} from '@/server/lib/holdings/services/ledger/revision'
import type { TLedgerPipelineRedis } from '@/server/lib/holdings/services/ledger/store'
import type {
  TLedgerCheckpointState,
  TLedgerCoverageStatus,
  TLedgerStream,
  TLedgerSyncReasonCode,
  TLedgerSyncStatusV1
} from '@/server/lib/holdings/services/ledger/types'
import { getHoldingsLedgerRedisClient } from '@/server/lib/holdings/storage/ledgerRedis'

export type TLedgerStatusErrorReason = Extract<TLedgerSyncReasonCode, 'storage_failed' | 'decode_failed'>

export class HoldingsLedgerStatusError extends Error {
  readonly reasonCode: TLedgerStatusErrorReason
  readonly statusCode: number

  constructor(reasonCode: TLedgerStatusErrorReason, statusCode: number) {
    super('Holdings ledger status read failed')
    this.name = 'HoldingsLedgerStatusError'
    this.reasonCode = reasonCode
    this.statusCode = statusCode
  }
}

export interface TLedgerStatusCoverageSummary {
  readonly stream: TLedgerStream
  readonly chainId: number
  readonly status: TLedgerCoverageStatus
  readonly coverageStartTimestamp: number
  readonly completeThroughTimestamp: number
  readonly coverageStartBlock: number
  readonly completeThroughBlock: number
  readonly count: number
  readonly checkpointState: TLedgerCheckpointState
}

export interface TLedgerStatusSummary {
  readonly status: 'empty' | 'ready'
  readonly headSource: 'active' | 'previous' | null
  readonly revision: string | null
  readonly sourceGeneration: number | null
  readonly counts: {
    readonly records: number
    readonly chunks: number
    readonly indexShards: number
  }
  readonly bytes: {
    readonly activeEncoded: number
    readonly chunksEncoded: number
    readonly chunksDecoded: number
    readonly indexesEncoded: number
    readonly indexesDecoded: number
  }
  readonly chainScope: readonly number[]
  readonly coverage: readonly TLedgerStatusCoverageSummary[]
  readonly dirty: {
    readonly fromTimestamp: number | null
    readonly fromDate: string | null
    readonly reasons: readonly string[]
  }
  readonly timestamps: {
    readonly createdAtMs: number | null
    readonly updatedAtMs: number | null
    readonly reconciledAtMs: number | null
  }
  readonly sync: {
    readonly state: TLedgerSyncStatusV1['state'] | 'missing'
    readonly reasonCode: TLedgerSyncReasonCode | null
    readonly sourceGeneration: number | null
    readonly revision: string | null
    readonly updatedAtMs: number | null
    readonly matchesHead: boolean | null
  }
}

function getSyncSummary(syncStatus: TLedgerSyncStatusReadResult): TLedgerStatusSummary['sync'] {
  if (syncStatus.status === 'corrupt') {
    throw new HoldingsLedgerStatusError('decode_failed', 500)
  }
  return syncStatus.status === 'missing'
    ? {
        state: 'missing',
        reasonCode: null,
        sourceGeneration: null,
        revision: null,
        updatedAtMs: null,
        matchesHead: null
      }
    : {
        state: syncStatus.value.state,
        reasonCode: syncStatus.value.reasonCode,
        sourceGeneration: syncStatus.value.sourceGeneration,
        revision: syncStatus.value.revision,
        updatedAtMs: syncStatus.value.updatedAtMs,
        matchesHead: null
      }
}

function getEmptySummary(sync: TLedgerStatusSummary['sync']): TLedgerStatusSummary {
  return {
    status: 'empty',
    headSource: null,
    revision: null,
    sourceGeneration: null,
    counts: { records: 0, chunks: 0, indexShards: 0 },
    bytes: {
      activeEncoded: 0,
      chunksEncoded: 0,
      chunksDecoded: 0,
      indexesEncoded: 0,
      indexesDecoded: 0
    },
    chainScope: [],
    coverage: [],
    dirty: { fromTimestamp: null, fromDate: null, reasons: [] },
    timestamps: { createdAtMs: null, updatedAtMs: null, reconciledAtMs: null },
    sync: { ...sync, matchesHead: sync.state === 'missing' ? null : false }
  }
}

function getReadySummary(
  revision: Extract<TLedgerRevisionReadResult, { readonly status: 'ready' }>,
  sync: TLedgerStatusSummary['sync']
): TLedgerStatusSummary {
  const manifest = revision.manifest
  return {
    status: 'ready',
    headSource: revision.headSource,
    revision: manifest.revision,
    sourceGeneration: manifest.sourceGeneration,
    counts: {
      records: manifest.recordCount,
      chunks: manifest.chunks.length,
      indexShards: manifest.indexes.length
    },
    bytes: {
      activeEncoded: manifest.activeEncodedBytes,
      chunksEncoded: manifest.chunks.reduce((total, chunk) => total + chunk.encodedBytes, 0),
      chunksDecoded: manifest.chunks.reduce((total, chunk) => total + chunk.decodedBytes, 0),
      indexesEncoded: manifest.indexes.reduce((total, index) => total + index.encodedBytes, 0),
      indexesDecoded: manifest.indexes.reduce((total, index) => total + index.decodedBytes, 0)
    },
    chainScope: [...manifest.chainScope],
    coverage: manifest.coverage.map((coverage) => ({
      stream: coverage.stream,
      chainId: coverage.chainId,
      status: coverage.status,
      coverageStartTimestamp: coverage.coverageStartTimestamp,
      completeThroughTimestamp: coverage.completeThroughTimestamp,
      coverageStartBlock: coverage.coverageStartBlock,
      completeThroughBlock: coverage.completeThroughBlock,
      count: coverage.count,
      checkpointState: coverage.checkpointState
    })),
    dirty: {
      fromTimestamp: manifest.dirtyFromTimestamp,
      fromDate: manifest.dirtyFromDate,
      reasons: [...manifest.dirtyReasons]
    },
    timestamps: {
      createdAtMs: manifest.createdAtMs,
      updatedAtMs: manifest.updatedAtMs,
      reconciledAtMs: manifest.reconciledAtMs
    },
    sync: {
      ...sync,
      matchesHead:
        sync.state === 'missing'
          ? null
          : sync.sourceGeneration === manifest.sourceGeneration && sync.revision === manifest.revision
    }
  }
}

export async function getHoldingsLedgerStatus(address: string): Promise<TLedgerStatusSummary> {
  try {
    const walletHash = hashLedgerWalletAddress(address)
    const redis = getHoldingsLedgerRedisClient() as TLedgerPipelineRedis | null
    if (!redis) {
      throw new HoldingsLedgerStatusError('storage_failed', 503)
    }
    const [revision, syncStatus] = await Promise.all([
      readVerifiedLedgerRevision({ redis, walletHash, retryIncomplete: true, fallbackToPrevious: true }),
      readLedgerSyncStatus({ redis, walletHash })
    ])
    if (revision.status === 'corrupt') {
      throw new HoldingsLedgerStatusError('decode_failed', 500)
    }
    const sync = getSyncSummary(syncStatus)
    return revision.status === 'empty' ? getEmptySummary(sync) : getReadySummary(revision, sync)
  } catch (error) {
    if (error instanceof HoldingsLedgerStatusError) {
      throw error
    }
    throw new HoldingsLedgerStatusError('storage_failed', 503)
  }
}
