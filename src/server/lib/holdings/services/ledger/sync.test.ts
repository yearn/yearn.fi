import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoldingsDebugContext, withHoldingsDebugContext } from '@/server/lib/holdings/services/debug'
import type { TEnvioLedgerFetchStrategy, TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import {
  HoldingsLedgerSyncError,
  syncHoldingsLedger,
  withSynchronizedHoldingsLedgerRevision
} from '@/server/lib/holdings/services/ledger/sync'
import {
  LEDGER_STREAMS,
  type TLedgerSixStreams,
  type TLedgerV3DepositSourceEvent
} from '@/server/lib/holdings/services/ledger/types'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const TRANSACTION_FROM = '0x3333333333333333333333333333333333333333'
const TRANSACTION_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const testState = vi.hoisted(() => ({
  redis: { marker: 'redis' },
  currentRead: { status: 'empty' } as unknown,
  metadataProgressBlock: 100_000,
  metadataEventsProcessed: 10_000,
  lastLowerBlockByChain: null as Readonly<Record<number, number>> | null,
  lastFetchStrategy: null as TEnvioLedgerFetchStrategy | null
}))

const mocks = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  renewLock: vi.fn(),
  releaseLock: vi.fn(),
  readRevision: vi.fn(),
  fetchMetadata: vi.fn(),
  fetchSource: vi.fn(),
  rereadMetadata: vi.fn(),
  writeBlobs: vi.fn(),
  writeStatus: vi.fn(),
  commitRevision: vi.fn(),
  recoverHead: vi.fn(),
  reportMetric: vi.fn(),
  fetchLegacy: vi.fn(),
  processLedgerEvents: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/ledger/lock', () => ({
  acquireLedgerLock: mocks.acquireLock,
  renewLedgerLock: mocks.renewLock,
  releaseLedgerLock: mocks.releaseLock
}))

vi.mock('@/server/lib/holdings/services/ledger/revision', () => ({
  readVerifiedLedgerRevision: mocks.readRevision
}))

vi.mock('@/server/lib/holdings/services/ledger/envio', () => ({
  fetchEnvioLedgerMetadata: mocks.fetchMetadata,
  fetchEnvioLedgerSource: mocks.fetchSource,
  rereadEnvioLedgerMetadata: mocks.rereadMetadata
}))

vi.mock('@/server/lib/holdings/services/ledger/store', () => ({
  writeImmutableLedgerBlobs: mocks.writeBlobs,
  writeLedgerSyncStatus: mocks.writeStatus,
  commitVerifiedLedgerRevision: mocks.commitRevision,
  recoverCorruptLedgerHeadFromPrevious: mocks.recoverHead
}))

vi.mock('@/server/lib/holdings/services/ledger/metrics', () => ({
  reportLedgerMetric: mocks.reportMetric
}))

vi.mock('@/server/lib/holdings/services/graphql', () => ({
  fetchUserLedgerSourceEvents: mocks.fetchLegacy,
  processLedgerSourceEvents: mocks.processLedgerEvents
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  HoldingsLedgerRedisOperationError: class HoldingsLedgerRedisOperationError extends Error {},
  getHoldingsLedgerRedisClient: () => testState.redis
}))

function createMetadata(): readonly TEnvioLedgerMetadata[] {
  return [
    {
      chainId: 1,
      progressBlock: testState.metadataProgressBlock,
      eventsProcessed: testState.metadataEventsProcessed,
      bufferBlock: testState.metadataProgressBlock + 5,
      firstEventBlock: 1,
      sourceBlock: testState.metadataProgressBlock + 10,
      readyAt: '2026-08-06T00:00:00.000Z',
      isReady: true,
      startBlock: 1,
      endBlock: null
    }
  ]
}

function createDeposit(): TLedgerV3DepositSourceEvent {
  return {
    id: 'deposit-1',
    vaultAddress: VAULT_ADDRESS,
    chainId: 1,
    blockNumber: 99_900,
    blockTimestamp: 1_775_000_000,
    logIndex: 4,
    transactionHash: TRANSACTION_HASH,
    transactionFrom: TRANSACTION_FROM,
    owner: USER_ADDRESS,
    sender: USER_ADDRESS,
    assets: '100',
    shares: '90'
  }
}

function createStreams(): TLedgerSixStreams {
  return {
    v3Deposits: [createDeposit()],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

function createFetchStats(strategy: TEnvioLedgerFetchStrategy) {
  const byStream = Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [stream, { pages: 1, rows: stream === 'v3Deposits' ? 1 : 0 }])
  )
  return {
    byStream,
    totalPages: LEDGER_STREAMS.length,
    totalRows: 1,
    chainCount: 1,
    validationQueries: strategy === 'faceted-batched' ? 1 : 0,
    strategy,
    totalRequests: strategy === 'faceted-batched' ? 2 : 1,
    presenceRequests: strategy === 'faceted-batched' ? 1 : 0,
    batchedRequests: 1,
    continuationRequests: 0
  }
}

function installSuccessfulMocks(): void {
  mocks.acquireLock.mockResolvedValue({ status: 'acquired', lock: { owner: 'test-owner', fence: 1 } })
  mocks.renewLock.mockResolvedValue({ status: 'renewed' })
  mocks.releaseLock.mockResolvedValue({ status: 'released' })
  mocks.readRevision.mockImplementation(() => Promise.resolve(testState.currentRead))
  mocks.fetchMetadata.mockImplementation(() => Promise.resolve(createMetadata()))
  mocks.fetchSource.mockImplementation(
    ({
      lowerBlockByChain,
      strategy
    }: {
      readonly lowerBlockByChain: Readonly<Record<number, number>>
      readonly strategy: TEnvioLedgerFetchStrategy
    }) => {
      testState.lastLowerBlockByChain = lowerBlockByChain
      testState.lastFetchStrategy = strategy
      const metadata = createMetadata()
      return Promise.resolve({
        metadata,
        windows: [
          {
            chainId: 1,
            lowerBlock: lowerBlockByChain[1] as number,
            upperBlock: testState.metadataProgressBlock
          }
        ],
        streams: createStreams(),
        stats: createFetchStats(strategy)
      })
    }
  )
  mocks.rereadMetadata.mockImplementation(() => Promise.resolve(createMetadata()))
  mocks.writeBlobs.mockImplementation(
    ({
      items
    }: {
      readonly items: readonly Array<{ readonly kind: string; readonly key: string; readonly checksum: string }>
    }) => Promise.resolve(items.map((item) => ({ ...item, status: 'written' })))
  )
  mocks.writeStatus.mockResolvedValue({ status: 'written' })
  mocks.recoverHead.mockResolvedValue({ status: 'recovered' })
  mocks.commitRevision.mockImplementation(({ revision }: { readonly revision: Record<string, unknown> }) => {
    const verified = revision as {
      readonly head: unknown
      readonly manifest: unknown
      readonly streams: unknown
      readonly headValue: string
    }
    testState.currentRead = {
      status: 'ready',
      headSource: 'active',
      head: verified.head,
      manifest: verified.manifest,
      verified
    }
    return Promise.resolve({ status: 'committed', head: verified.headValue, previousHead: null })
  })
}

describe('holdings ledger synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1')
    testState.currentRead = { status: 'empty' }
    testState.metadataProgressBlock = 100_000
    testState.metadataEventsProcessed = 10_000
    testState.lastLowerBlockByChain = null
    testState.lastFetchStrategy = null
    installSuccessfulMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('bootstraps, advances with an overlap window, then skips an identical checkpoint', async () => {
    const cold = await syncHoldingsLedger({ address: USER_ADDRESS })

    expect(cold.status).toBe('updated')
    expect(cold.status === 'updated' && cold.syncType).toBe('bootstrap')
    expect(testState.lastLowerBlockByChain).toEqual({ 1: 1 })
    expect(testState.lastFetchStrategy).toBe('faceted-batched')
    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
    const coldRevision = testState.currentRead as {
      readonly status: 'ready'
      readonly manifest: {
        readonly chunks: readonly unknown[]
        readonly indexes: readonly unknown[]
        readonly chunksChecksum: string
        readonly indexesChecksum: string
      }
    }
    mocks.writeBlobs.mockClear()

    testState.metadataProgressBlock = 100_010
    testState.metadataEventsProcessed = 10_001
    const warm = await syncHoldingsLedger({ address: USER_ADDRESS })

    expect(warm.status).toBe('updated')
    expect(warm.status === 'updated' && warm.syncType).toBe('warm')
    expect(testState.lastLowerBlockByChain).toEqual({ 1: 50_000 })
    expect(testState.lastFetchStrategy).toBe('warm-batched')
    expect(mocks.commitRevision).toHaveBeenCalledTimes(2)
    expect(warm.status === 'updated' && warm.storage.newBlobs).toBe(0)
    const warmRevision = testState.currentRead as typeof coldRevision
    expect(warmRevision.manifest.chunks).toEqual(coldRevision.manifest.chunks)
    expect(warmRevision.manifest.indexes).toEqual(coldRevision.manifest.indexes)
    expect(warmRevision.manifest.chunksChecksum).toBe(coldRevision.manifest.chunksChecksum)
    expect(warmRevision.manifest.indexesChecksum).toBe(coldRevision.manifest.indexesChecksum)
    expect(mocks.writeBlobs).not.toHaveBeenCalled()

    const unchanged = await syncHoldingsLedger({ address: USER_ADDRESS })

    expect(unchanged.status).toBe('unchanged')
    expect(unchanged.status === 'unchanged' && unchanged.syncType).toBe('warm')
    expect(testState.lastLowerBlockByChain).toEqual({ 1: 50_010 })
    expect(mocks.commitRevision).toHaveBeenCalledTimes(2)
    expect(mocks.writeBlobs).not.toHaveBeenCalled()
    expect(mocks.writeStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'complete' }) })
    )
    expect(mocks.releaseLock).toHaveBeenCalledTimes(3)
  })

  it('keeps opted-in debug stage payloads free of ledger identifiers', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const context = createHoldingsDebugContext('ledger-sync', USER_ADDRESS, true)

    try {
      const result = await withHoldingsDebugContext(context, () => syncHoldingsLedger({ address: USER_ADDRESS }))
      const output = consoleLog.mock.calls.map(([message]) => String(message)).join('\n')

      expect(output).toContain('[ledger-sync] fetched Envio synchronization metadata')
      expect(output).toContain('[ledger-sync] fetched authoritative Envio event windows')
      expect(output).toContain('[ledger-sync] published immutable revision blobs')
      expect(output).toContain('[ledger-sync] completed fenced revision head commit')
      expect(output).toContain('[ledger-sync] released wallet synchronization lock')
      expect(output).toContain('"pages":6')
      expect(output).toContain('"rows":1')
      expect(output).toContain('"strategy":"faceted-batched"')
      expect(output).toContain('"requests":2')
      expect(output).toContain('"presenceRequests":1')
      expect(output).not.toContain(USER_ADDRESS)
      expect(output).not.toContain(hashLedgerWalletAddress(USER_ADDRESS))
      expect(output).not.toContain(VAULT_ADDRESS)
      expect(output).not.toContain(TRANSACTION_FROM)
      expect(output).not.toContain(TRANSACTION_HASH)
      expect(output).not.toContain('https://envio.example/graphql')
      if (result.status === 'updated') {
        expect(output).not.toContain(result.revision)
      }
    } finally {
      consoleLog.mockRestore()
    }
  })

  it('returns a non-mutating busy result when another worker owns the wallet lock', async () => {
    mocks.acquireLock.mockResolvedValueOnce({ status: 'busy' })

    await expect(syncHoldingsLedger({ address: USER_ADDRESS })).resolves.toEqual({
      status: 'syncing',
      reasonCode: 'lock_busy'
    })
    expect(mocks.readRevision).not.toHaveBeenCalled()
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
    expect(mocks.commitRevision).not.toHaveBeenCalled()
    expect(mocks.releaseLock).not.toHaveBeenCalled()
  })

  it('does not invoke a synchronized-revision consumer without a completed synchronization', async () => {
    const consume = vi.fn()
    mocks.acquireLock.mockResolvedValueOnce({ status: 'busy' })

    await expect(withSynchronizedHoldingsLedgerRevision({ address: USER_ADDRESS }, consume)).resolves.toEqual({
      kind: 'busy',
      syncResult: { status: 'syncing', reasonCode: 'lock_busy' }
    })
    expect(consume).not.toHaveBeenCalled()

    mocks.acquireLock.mockResolvedValueOnce({ status: 'acquired', lock: { owner: 'test-owner', fence: 2 } })
    mocks.commitRevision.mockResolvedValueOnce({ status: 'head_conflict' })
    await expect(withSynchronizedHoldingsLedgerRevision({ address: USER_ADDRESS }, consume)).rejects.toMatchObject({
      reasonCode: 'cas_rejected',
      statusCode: 409
    })
    expect(consume).not.toHaveBeenCalled()
  })

  it('exposes the exact synchronized revision to a consumer before releasing the wallet lock', async () => {
    const consumed = await withSynchronizedHoldingsLedgerRevision({ address: USER_ADDRESS }, async (context) => {
      expect(mocks.releaseLock).not.toHaveBeenCalled()
      expect(context.verifiedRevision).toBe(
        (testState.currentRead as { readonly status: 'ready'; readonly verified: unknown }).verified
      )
      expect(context.syncResult.status).toBe('updated')
      return context.verifiedRevision
    })

    expect(consumed.kind).toBe('completed')
    expect(consumed.kind === 'completed' && consumed.consumed).toBe(
      (testState.currentRead as { readonly status: 'ready'; readonly verified: unknown }).verified
    )
    expect(mocks.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('exposes the existing verified revision when a warm synchronization is unchanged', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const existing = (testState.currentRead as { readonly status: 'ready'; readonly verified: unknown }).verified
    mocks.releaseLock.mockClear()

    const synchronized = await withSynchronizedHoldingsLedgerRevision({ address: USER_ADDRESS }, async (context) => {
      expect(context.syncResult.status).toBe('unchanged')
      expect(context.verifiedRevision).toBe(existing)
      expect(mocks.releaseLock).not.toHaveBeenCalled()
      return context.verifiedRevision
    })

    expect(synchronized.kind).toBe('completed')
    expect(synchronized.kind === 'completed' && synchronized.consumed).toBe(existing)
    expect(mocks.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('releases the lock without rewriting successful sync state when the consumer fails', async () => {
    const consumerError = new Error('snapshot pointer write failed')

    await expect(
      withSynchronizedHoldingsLedgerRevision({ address: USER_ADDRESS }, async () => {
        throw consumerError
      })
    ).rejects.toBe(consumerError)

    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
    expect(mocks.writeStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'failed' }) })
    )
    expect(mocks.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('falls back to newly encoded immutable content when a warm event changes', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const fetchSource = mocks.fetchSource.getMockImplementation()
    testState.metadataProgressBlock = 100_010
    testState.metadataEventsProcessed = 10_001
    mocks.writeBlobs.mockClear()
    mocks.fetchSource.mockImplementationOnce(async (input) => {
      const fetched = await fetchSource?.(input)
      if (!fetched) {
        throw new Error('Expected the default Envio source mock')
      }
      return {
        ...fetched,
        streams: {
          ...fetched.streams,
          v3Deposits: [{ ...createDeposit(), assets: '101' }]
        }
      }
    })

    const result = await syncHoldingsLedger({ address: USER_ADDRESS })

    expect(result).toMatchObject({ status: 'updated', syncType: 'warm' })
    expect(result.status === 'updated' && result.storage.newBlobs).toBeGreaterThan(0)
    expect(mocks.writeBlobs).toHaveBeenCalledWith(
      expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ kind: 'chunk' })]) })
    )
  })

  it('uses the full codec path for a forced rebuild even when the fetched events are identical', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const context = createHoldingsDebugContext('ledger-sync', USER_ADDRESS, true)

    try {
      const result = await withHoldingsDebugContext(context, () =>
        syncHoldingsLedger({ address: USER_ADDRESS, forceRebuild: true })
      )
      const output = consoleLog.mock.calls.map(([message]) => String(message)).join('\n')

      expect(result).toMatchObject({ status: 'updated', syncType: 'forced-reset' })
      expect(output).toContain('"contentMode":"encoded"')
      expect(output).not.toContain('"contentMode":"reused-verified"')
    } finally {
      consoleLog.mockRestore()
    }
  })

  it('renews the fenced lock from a throttled source-page heartbeat', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T00:00:00.000Z'))
    const fetchSource = mocks.fetchSource.getMockImplementation()
    mocks.fetchSource.mockImplementationOnce(async (input) => {
      vi.setSystemTime(new Date('2026-08-06T00:01:01.000Z'))
      await input.onPage()
      return fetchSource?.(input)
    })

    await expect(syncHoldingsLedger({ address: USER_ADDRESS })).resolves.toMatchObject({ status: 'updated' })

    expect(mocks.renewLock).toHaveBeenCalledTimes(3)
  })

  it('keeps the last-known-good revision when an incremental source fetch fails', async () => {
    const cold = await syncHoldingsLedger({ address: USER_ADDRESS })
    expect(cold.status).toBe('updated')
    const lastKnownGood = testState.currentRead
    mocks.fetchSource.mockRejectedValueOnce(new Error('Envio ledger source request failed'))

    const failure = syncHoldingsLedger({ address: USER_ADDRESS })
    await expect(failure).rejects.toBeInstanceOf(HoldingsLedgerSyncError)
    await expect(failure).rejects.toMatchObject({ reasonCode: 'upstream_failed', statusCode: 502 })

    expect(testState.currentRead).toBe(lastKnownGood)
    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
    expect(mocks.writeStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({ state: 'failed', reasonCode: 'upstream_failed' })
      })
    )
    expect(mocks.releaseLock).toHaveBeenCalledTimes(2)
  })

  it('force-rebuilds a corrupt active head only after atomically restoring its verified previous revision', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const previous = testState.currentRead
    testState.currentRead = { status: 'corrupt' }
    mocks.readRevision.mockImplementation(({ usePreviousHead }: { readonly usePreviousHead?: boolean }) =>
      Promise.resolve(usePreviousHead ? previous : testState.currentRead)
    )
    mocks.recoverHead.mockImplementation(() => {
      testState.currentRead = previous
      return Promise.resolve({ status: 'recovered' })
    })

    const result = await syncHoldingsLedger({ address: USER_ADDRESS, forceRebuild: true })

    expect(result).toMatchObject({ status: 'updated', syncType: 'forced-reset' })
    expect(mocks.recoverHead).toHaveBeenCalledWith(expect.objectContaining({ previousRevision: expect.any(Object) }))
    expect(mocks.commitRevision).toHaveBeenCalledTimes(2)
    expect(mocks.reportMetric).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ledger.recovery', outcome: 'success', fallback: 'previous-head' })
    )
  })

  it('keeps the restored revision and records failure against it when work fails after rollback', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const previous = testState.currentRead as {
      readonly status: 'ready'
      readonly head: { readonly revision: string; readonly sourceGeneration: number }
    }
    testState.currentRead = { status: 'corrupt' }
    mocks.readRevision.mockImplementation(({ usePreviousHead }: { readonly usePreviousHead?: boolean }) =>
      Promise.resolve(usePreviousHead ? previous : testState.currentRead)
    )
    mocks.recoverHead.mockImplementation(() => {
      testState.currentRead = previous
      return Promise.resolve({ status: 'recovered' })
    })
    mocks.fetchMetadata.mockRejectedValueOnce(new Error('Envio ledger source request failed'))

    await expect(syncHoldingsLedger({ address: USER_ADDRESS, forceRebuild: true })).rejects.toMatchObject({
      reasonCode: 'upstream_failed',
      statusCode: 502
    })

    expect(testState.currentRead).toBe(previous)
    expect(mocks.recoverHead).toHaveBeenCalledWith(
      expect.objectContaining({
        syncStatus: expect.objectContaining({
          state: 'syncing',
          sourceGeneration: previous.head.sourceGeneration,
          revision: previous.head.revision
        })
      })
    )
    expect(mocks.writeStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          state: 'failed',
          sourceGeneration: previous.head.sourceGeneration,
          revision: previous.head.revision,
          reasonCode: 'upstream_failed'
        })
      })
    )
    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
  })

  it('fails closed on a corrupt active head unless forceRebuild is explicit', async () => {
    testState.currentRead = { status: 'corrupt' }

    await expect(syncHoldingsLedger({ address: USER_ADDRESS })).rejects.toMatchObject({
      reasonCode: 'decode_failed',
      statusCode: 500
    })
    expect(mocks.recoverHead).not.toHaveBeenCalled()
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
    expect(mocks.commitRevision).not.toHaveBeenCalled()
  })

  it.each([
    ['lock_lost', 'stale_fence', 409],
    ['previous_changed', 'cas_rejected', 409],
    ['active_missing', 'decode_failed', 500]
  ] as const)('maps %s during forced head recovery to %s', async (recoveryStatus, reasonCode, statusCode) => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const previous = testState.currentRead
    testState.currentRead = { status: 'corrupt' }
    mocks.readRevision.mockImplementation(({ usePreviousHead }: { readonly usePreviousHead?: boolean }) =>
      Promise.resolve(usePreviousHead ? previous : testState.currentRead)
    )
    mocks.recoverHead.mockResolvedValueOnce({ status: recoveryStatus })

    await expect(syncHoldingsLedger({ address: USER_ADDRESS, forceRebuild: true })).rejects.toMatchObject({
      reasonCode,
      statusCode
    })
    expect(testState.currentRead).toEqual({ status: 'corrupt' })
    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
  })

  it('compares all six raw legacy streams at the pinned per-chain checkpoint', async () => {
    const extra = { ...createDeposit(), id: 'future-deposit', blockNumber: 100_001 }
    mocks.fetchLegacy.mockResolvedValueOnce({
      ...createStreams(),
      v3Deposits: [createDeposit(), extra]
    })

    const matching = await syncHoldingsLedger({ address: USER_ADDRESS, compareLegacy: true })
    expect(matching.status !== 'syncing' && matching.parity).toEqual({ status: 'match', reasonCode: null })

    mocks.fetchLegacy.mockResolvedValueOnce({
      ...createStreams(),
      v3Deposits: [{ ...createDeposit(), assets: '101' }]
    })
    const mismatch = await syncHoldingsLedger({ address: USER_ADDRESS, compareLegacy: true })
    expect(mismatch.status !== 'syncing' && mismatch.parity).toEqual({
      status: 'mismatch',
      reasonCode: 'event-mismatch'
    })
  })

  it('rejects a partial metadata chain set instead of deleting cached chain history', async () => {
    await syncHoldingsLedger({ address: USER_ADDRESS })
    const ready = testState.currentRead as {
      readonly status: 'ready'
      readonly head: unknown
      readonly manifest: Record<string, unknown>
      readonly verified: unknown
    }
    testState.currentRead = {
      ...ready,
      manifest: { ...ready.manifest, chainScope: [1, 10] }
    }
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10')
    mocks.fetchSource.mockClear()

    await expect(syncHoldingsLedger({ address: USER_ADDRESS })).rejects.toMatchObject({
      reasonCode: 'upstream_failed',
      statusCode: 502
    })
    expect(mocks.fetchSource).not.toHaveBeenCalled()
    expect(mocks.commitRevision).toHaveBeenCalledTimes(1)
  })
})
