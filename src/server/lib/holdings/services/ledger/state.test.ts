import { describe, expect, it } from 'vitest'
import { getLedgerSha256, stringifyCanonicalLedgerValue } from '@/server/lib/holdings/services/ledger/codec'
import type { TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import { mergeLedgerStreams } from '@/server/lib/holdings/services/ledger/merge'
import {
  createLedgerCoverage,
  getLedgerDirtyMetadata,
  getLedgerLowerBlocks,
  getLedgerSourceFingerprint,
  inferLedgerSyncType,
  LEDGER_CALCULATION_VERSION
} from '@/server/lib/holdings/services/ledger/state'
import {
  LEDGER_STREAMS,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams
} from '@/server/lib/holdings/services/ledger/types'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const metadata: TEnvioLedgerMetadata = {
  chainId: 1,
  progressBlock: 1_000,
  eventsProcessed: 20,
  bufferBlock: 1_001,
  firstEventBlock: 1,
  sourceBlock: 1_002,
  readyAt: null,
  isReady: true,
  startBlock: 1,
  endBlock: null
}

function streams(): TLedgerSixStreams {
  return {
    v3Deposits: [
      {
        id: 'deposit',
        vaultAddress: ADDRESS,
        chainId: 1,
        blockNumber: 900,
        blockTimestamp: 1_700_000_000,
        logIndex: 0,
        transactionHash: `0x${'1'.repeat(64)}`,
        transactionFrom: ADDRESS,
        owner: ADDRESS,
        sender: ADDRESS,
        assets: '1',
        shares: '1'
      }
    ],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

function currentManifest(overrides: Partial<TLedgerRevisionManifestV1> = {}): TLedgerRevisionManifestV1 {
  const coverage = createLedgerCoverage(streams(), [metadata])
  return {
    schemaVersion: 1,
    codec: 'brotli-q4-base64',
    calculationVersion: LEDGER_CALCULATION_VERSION,
    walletHash: 'a'.repeat(64),
    sourceFingerprint: getLedgerSha256('source'),
    sourceGeneration: 1,
    revision: 'revision-1',
    parentRevision: null,
    chainScope: [1],
    coverage,
    chunks: [],
    indexes: [],
    dependencies: [],
    invalidationEpochs: { global: 0, source: 0, address: 0, vault: 0, schema: 0, metadata: 0 },
    dirtyFromTimestamp: null,
    dirtyFromDate: null,
    dirtyReasons: [],
    createdAtMs: 1_000,
    updatedAtMs: 1_000,
    reconciledAtMs: 1_000,
    recordCount: 1,
    activeEncodedBytes: 0,
    chunksChecksum: getLedgerSha256(stringifyCanonicalLedgerValue([])),
    indexesChecksum: getLedgerSha256(stringifyCanonicalLedgerValue([])),
    ...overrides
  }
}

describe('ledger synchronization state', () => {
  it('uses source contracts rather than moving progress in the source fingerprint', () => {
    const first = getLedgerSourceFingerprint('source-a', [metadata], 'deploy-a')
    const progressed = getLedgerSourceFingerprint(
      'source-a',
      [{ ...metadata, progressBlock: 2_000, eventsProcessed: 40 }],
      'deploy-a'
    )
    const throttled = getLedgerSourceFingerprint(
      'source-a',
      [{ ...metadata, firstEventBlock: 50, sourceBlock: 2_100, readyAt: '2026-08-06T00:00:00.000Z', isReady: false }],
      'deploy-a'
    )
    const switched = getLedgerSourceFingerprint('source-b', [metadata], 'deploy-a')
    const reindexed = getLedgerSourceFingerprint('source-a', [metadata], 'deploy-b')

    expect(progressed).toBe(first)
    expect(throttled).toBe(first)
    expect(switched).not.toBe(first)
    expect(reindexed).not.toBe(first)
    expect(
      inferLedgerSyncType({
        current: currentManifest({ sourceFingerprint: first }),
        sourceFingerprint: reindexed,
        forceRebuild: false,
        nowMs: 2_000,
        reconcileIntervalMs: 10
      })
    ).toBe('source-reset')
  })

  it('infers bootstrap, source reset, forced reset, reconcile, and warm modes', () => {
    const current = currentManifest()
    const sourceFingerprint = current.sourceFingerprint

    expect(
      inferLedgerSyncType({
        current: null,
        sourceFingerprint,
        forceRebuild: false,
        nowMs: 2_000,
        reconcileIntervalMs: 10
      })
    ).toBe('bootstrap')
    expect(
      inferLedgerSyncType({
        current,
        sourceFingerprint: 'b'.repeat(64),
        forceRebuild: false,
        nowMs: 2_000,
        reconcileIntervalMs: 10
      })
    ).toBe('source-reset')
    expect(
      inferLedgerSyncType({ current, sourceFingerprint, forceRebuild: true, nowMs: 2_000, reconcileIntervalMs: 10 })
    ).toBe('forced-reset')
    expect(
      inferLedgerSyncType({ current, sourceFingerprint, forceRebuild: false, nowMs: 2_000, reconcileIntervalMs: 10 })
    ).toBe('reconcile')
    expect(
      inferLedgerSyncType({ current, sourceFingerprint, forceRebuild: false, nowMs: 1_005, reconcileIntervalMs: 10 })
    ).toBe('warm')
  })

  it('rewinds warm checkpoints and fully rewinds reconciliation', () => {
    const current = currentManifest()
    expect(getLedgerLowerBlocks({ metadata: [metadata], current, syncType: 'warm', overlapBlocks: 100 })).toEqual({
      1: 900
    })
    expect(getLedgerLowerBlocks({ metadata: [metadata], current, syncType: 'reconcile', overlapBlocks: 100 })).toEqual({
      1: 1
    })
  })

  it('fails closed on a checkpoint regression outside a new source generation', () => {
    const current = currentManifest()
    const regressed = { ...metadata, progressBlock: 899 }

    expect(() =>
      getLedgerLowerBlocks({ metadata: [regressed], current, syncType: 'reconcile', overlapBlocks: 100 })
    ).toThrow('Envio ledger source checkpoint regressed')
    expect(() =>
      getLedgerLowerBlocks({ metadata: [regressed], current, syncType: 'forced-reset', overlapBlocks: 100 })
    ).toThrow('Envio ledger source checkpoint regressed')
    expect(
      getLedgerLowerBlocks({ metadata: [regressed], current, syncType: 'source-reset', overlapBlocks: 100 })
    ).toEqual({ 1: 1 })
  })

  it('builds complete and valid-empty block-checkpoint coverage', () => {
    const coverage = createLedgerCoverage(streams(), [metadata])
    const depositCoverage = coverage.find((entry) => entry.stream === 'v3Deposits')
    const emptyCoverage = coverage.find((entry) => entry.stream === 'v3Withdrawals')

    expect(coverage).toHaveLength(LEDGER_STREAMS.length)
    expect(depositCoverage).toMatchObject({
      status: 'complete',
      coverageStartBlock: 1,
      completeThroughBlock: 1_000,
      count: 1,
      checkpointState: 'observed'
    })
    expect(emptyCoverage).toMatchObject({
      status: 'valid_empty',
      completeThroughBlock: 1_000,
      cursor: null,
      count: 0
    })
  })

  it('combines replacement/deletion dirtiness with an existing dirty suffix', () => {
    const cached = streams()
    const fetched = { ...streams(), v3Deposits: [] }
    const merge = mergeLedgerStreams({
      cached,
      fetched,
      windows: LEDGER_STREAMS.map((stream) => ({ stream, chainId: 1, lowerBlock: 800, upperBlock: 1_000 }))
    })
    const dirty = getLedgerDirtyMetadata({
      current: currentManifest({
        dirtyFromTimestamp: 1_600_000_000,
        dirtyFromDate: '2020-09-13',
        dirtyReasons: ['metadata_changed']
      }),
      previousStreams: cached,
      streams: fetched,
      merge,
      syncType: 'warm'
    })

    expect(dirty).toEqual({
      dirtyFromTimestamp: 1_600_000_000,
      dirtyFromDate: '2020-09-13',
      dirtyReasons: ['event_deleted', 'metadata_changed']
    })
  })

  it('dirties the old suffix when a source reset removes every event', () => {
    const previousStreams = streams()
    const emptyStreams = {
      v3Deposits: [],
      v3Withdrawals: [],
      v2Deposits: [],
      v2Withdrawals: [],
      transfersIn: [],
      transfersOut: []
    } satisfies TLedgerSixStreams
    const merge = mergeLedgerStreams({
      cached: emptyStreams,
      fetched: emptyStreams,
      windows: LEDGER_STREAMS.map((stream) => ({ stream, chainId: 1, lowerBlock: 1, upperBlock: 1_000 }))
    })

    expect(
      getLedgerDirtyMetadata({
        current: currentManifest(),
        previousStreams,
        streams: emptyStreams,
        merge,
        syncType: 'source-reset'
      })
    ).toEqual({
      dirtyFromTimestamp: 1_700_000_000,
      dirtyFromDate: '2023-11-14',
      dirtyReasons: ['source_generation']
    })
  })
})
