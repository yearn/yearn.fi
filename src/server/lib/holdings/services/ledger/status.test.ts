import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHoldingsLedgerStatus, type HoldingsLedgerStatusError } from '@/server/lib/holdings/services/ledger/status'

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(),
  readRevision: vi.fn(),
  readSyncStatus: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/ledger/revision', () => ({
  readVerifiedLedgerRevision: mocks.readRevision,
  readLedgerSyncStatus: mocks.readSyncStatus
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRedisClient: mocks.getRedis
}))

const ADDRESS = '0x1111111111111111111111111111111111111111'
const REDIS = { pipeline: vi.fn() }

function createReadyRevision() {
  return {
    status: 'ready',
    headSource: 'active',
    head: { walletHash: 'private-wallet-hash' },
    verified: { streams: { privateEvent: 'private-event-payload' } },
    manifest: {
      revision: 'revision_01',
      sourceGeneration: 3,
      recordCount: 7,
      activeEncodedBytes: 1_024,
      walletHash: 'private-wallet-hash',
      sourceFingerprint: 'private-source-fingerprint',
      chainScope: [1, 10],
      chunks: [
        {
          key: 'private-chunk-key',
          checksum: 'private-chunk-checksum',
          encodedBytes: 100,
          decodedBytes: 400
        }
      ],
      indexes: [
        {
          key: 'private-index-key',
          checksum: 'private-index-checksum',
          encodedBytes: 20,
          decodedBytes: 80
        }
      ],
      coverage: [
        {
          stream: 'v3Deposits',
          chainId: 1,
          status: 'complete',
          coverageStartTimestamp: 1_700_000_000,
          completeThroughTimestamp: 1_800_000_000,
          coverageStartBlock: 18_000_000,
          completeThroughBlock: 20_000_000,
          count: 7,
          checkpointState: 'pinned',
          checkpoint: 'private-checkpoint',
          checksum: 'private-coverage-checksum',
          cursor: { id: 'private-event-id' }
        }
      ],
      dirtyFromTimestamp: 1_700_000_000,
      dirtyFromDate: '2023-11-14',
      dirtyReasons: ['tail_append'],
      createdAtMs: 1_000,
      updatedAtMs: 2_000,
      reconciledAtMs: 1_500
    }
  }
}

describe('holdings ledger status service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRedis.mockReturnValue(REDIS)
    mocks.readRevision.mockResolvedValue(createReadyRevision())
    mocks.readSyncStatus.mockResolvedValue({
      status: 'ok',
      value: {
        state: 'failed',
        reasonCode: 'upstream_failed',
        revision: 'revision_01',
        sourceGeneration: 3,
        updatedAtMs: 3_000
      }
    })
  })

  it('fully reads and returns only aggregate, coverage-bound, and sync summary fields', async () => {
    const summary = await getHoldingsLedgerStatus(ADDRESS)
    const walletHash = createHash('sha256').update(ADDRESS).digest('hex')

    expect(mocks.readRevision).toHaveBeenCalledWith({
      redis: REDIS,
      walletHash,
      retryIncomplete: true,
      fallbackToPrevious: true
    })
    expect(mocks.readSyncStatus).toHaveBeenCalledWith({ redis: REDIS, walletHash })
    expect(summary).toEqual({
      status: 'ready',
      headSource: 'active',
      revision: 'revision_01',
      sourceGeneration: 3,
      counts: { records: 7, chunks: 1, indexShards: 1 },
      bytes: {
        activeEncoded: 1_024,
        chunksEncoded: 100,
        chunksDecoded: 400,
        indexesEncoded: 20,
        indexesDecoded: 80
      },
      chainScope: [1, 10],
      coverage: [
        {
          stream: 'v3Deposits',
          chainId: 1,
          status: 'complete',
          coverageStartTimestamp: 1_700_000_000,
          completeThroughTimestamp: 1_800_000_000,
          coverageStartBlock: 18_000_000,
          completeThroughBlock: 20_000_000,
          count: 7,
          checkpointState: 'pinned'
        }
      ],
      dirty: {
        fromTimestamp: 1_700_000_000,
        fromDate: '2023-11-14',
        reasons: ['tail_append']
      },
      timestamps: { createdAtMs: 1_000, updatedAtMs: 2_000, reconciledAtMs: 1_500 },
      sync: {
        state: 'failed',
        reasonCode: 'upstream_failed',
        sourceGeneration: 3,
        revision: 'revision_01',
        updatedAtMs: 3_000,
        matchesHead: true
      }
    })

    const serialized = JSON.stringify(summary)
    const secrets = [
      'private-wallet-hash',
      'private-source-fingerprint',
      'private-chunk-key',
      'private-chunk-checksum',
      'private-index-key',
      'private-index-checksum',
      'private-checkpoint',
      'private-coverage-checksum',
      'private-event-id',
      'private-event-payload'
    ]
    secrets.forEach((secret) => {
      expect(serialized).not.toContain(secret)
    })
  })

  it('returns a stable empty summary when no verified revision or sync status exists', async () => {
    mocks.readRevision.mockResolvedValue({ status: 'empty' })
    mocks.readSyncStatus.mockResolvedValue({ status: 'missing' })

    await expect(getHoldingsLedgerStatus(ADDRESS)).resolves.toEqual({
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
      sync: {
        state: 'missing',
        reasonCode: null,
        sourceGeneration: null,
        revision: null,
        updatedAtMs: null,
        matchesHead: null
      }
    })
  })

  it('reports when the verified summary came from the last-known-good previous head', async () => {
    mocks.readRevision.mockResolvedValue({ ...createReadyRevision(), headSource: 'previous' })
    mocks.readSyncStatus.mockResolvedValue({
      status: 'ok',
      value: {
        state: 'complete',
        reasonCode: null,
        revision: 'corrupt-active-revision',
        sourceGeneration: 3,
        updatedAtMs: 3_000
      }
    })

    await expect(getHoldingsLedgerStatus(ADDRESS)).resolves.toMatchObject({
      status: 'ready',
      headSource: 'previous',
      revision: 'revision_01',
      sync: { matchesHead: false }
    })
  })

  it('maps corrupt verified or sync reads to fixed decode failures', async () => {
    mocks.readRevision.mockResolvedValue({ status: 'corrupt' })

    await expect(getHoldingsLedgerStatus(ADDRESS)).rejects.toMatchObject<Partial<HoldingsLedgerStatusError>>({
      message: 'Holdings ledger status read failed',
      reasonCode: 'decode_failed',
      statusCode: 500
    })

    mocks.readRevision.mockResolvedValue({ status: 'empty' })
    mocks.readSyncStatus.mockResolvedValue({ status: 'corrupt' })
    await expect(getHoldingsLedgerStatus(ADDRESS)).rejects.toMatchObject<Partial<HoldingsLedgerStatusError>>({
      message: 'Holdings ledger status read failed',
      reasonCode: 'decode_failed',
      statusCode: 500
    })
  })

  it('maps missing storage and rejected reads to fixed storage failures', async () => {
    mocks.getRedis.mockReturnValue(null)
    await expect(getHoldingsLedgerStatus(ADDRESS)).rejects.toMatchObject<Partial<HoldingsLedgerStatusError>>({
      reasonCode: 'storage_failed',
      statusCode: 503
    })

    mocks.getRedis.mockReturnValue(REDIS)
    mocks.readRevision.mockRejectedValue(new Error('private Redis command and key'))
    await expect(getHoldingsLedgerStatus(ADDRESS)).rejects.toMatchObject<Partial<HoldingsLedgerStatusError>>({
      message: 'Holdings ledger status read failed',
      reasonCode: 'storage_failed',
      statusCode: 503
    })
  })
})
