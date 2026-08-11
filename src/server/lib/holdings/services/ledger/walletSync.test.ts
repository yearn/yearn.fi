import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoldingsDebugContext, withHoldingsDebugContext } from '@/server/lib/holdings/services/debug'
import type { TEnvioLedgerFetchStrategy, TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import type { TLedgerSixStreams, TLedgerV3DepositSourceEvent } from '@/server/lib/holdings/services/ledger/types'
import { decodeWalletLedgerValue } from '@/server/lib/holdings/services/ledger/walletCodec'
import { synchronizeWalletLedger, withSynchronizedWalletLedger } from '@/server/lib/holdings/services/ledger/walletSync'
import {
  type TWalletLedgerState,
  WALLET_LEDGER_EMPTY_TTL_MS,
  WALLET_LEDGER_FRESHNESS_MS
} from '@/server/lib/holdings/services/ledger/walletTypes'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const TRANSACTION_HASH = `0x${'a'.repeat(64)}`
const STARTED_AT_MS = 2_000_000

const testState = vi.hoisted(() => ({
  stored: null as TWalletLedgerState | null,
  metadataProgressBlock: 1_000,
  rereadProgressBlock: 1_000,
  fetchedStreams: null as TLedgerSixStreams | null,
  lowerBlockByChain: null as Readonly<Record<number, number>> | null,
  strategy: null as TEnvioLedgerFetchStrategy | null,
  commitStatus: 'ok' as 'ok' | 'lock_lost'
}))

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  renew: vi.fn(),
  release: vi.fn(),
  read: vi.fn(),
  commit: vi.fn(),
  fetchMetadata: vi.fn(),
  fetchSource: vi.fn(),
  rereadMetadata: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/ledger/walletStore', () => ({
  acquireWalletLedgerLock: mocks.acquire,
  renewWalletLedgerLock: mocks.renew,
  releaseWalletLedgerLock: mocks.release,
  readStoredWalletLedger: mocks.read,
  commitStoredWalletLedger: mocks.commit
}))

vi.mock('@/server/lib/holdings/services/ledger/envio', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/ledger/envio')>()
  return {
    ...original,
    fetchEnvioLedgerMetadata: mocks.fetchMetadata,
    fetchEnvioLedgerSource: mocks.fetchSource,
    rereadEnvioLedgerMetadata: mocks.rereadMetadata
  }
})

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  HoldingsLedgerRedisOperationError: class HoldingsLedgerRedisOperationError extends Error {},
  getHoldingsLedgerRedisClient: () => ({ marker: 'wallet-ledger-redis' })
}))

function createMetadata(progressBlock = testState.metadataProgressBlock): readonly TEnvioLedgerMetadata[] {
  return [
    {
      chainId: 1,
      progressBlock,
      eventsProcessed: progressBlock,
      bufferBlock: progressBlock + 1,
      firstEventBlock: 1,
      sourceBlock: progressBlock + 2,
      readyAt: '2026-08-11T00:00:00.000Z',
      isReady: true,
      startBlock: 1,
      endBlock: null
    }
  ]
}

function createDeposit(blockNumber = 100): TLedgerV3DepositSourceEvent {
  return {
    id: `deposit-${blockNumber}`,
    vaultAddress: VAULT_ADDRESS,
    chainId: 1,
    blockNumber,
    blockTimestamp: blockNumber * 10,
    logIndex: 1,
    transactionHash: TRANSACTION_HASH,
    transactionFrom: USER_ADDRESS,
    owner: USER_ADDRESS,
    sender: USER_ADDRESS,
    assets: '100',
    shares: '90'
  }
}

function createStreams(deposits: readonly TLedgerV3DepositSourceEvent[] = []): TLedgerSixStreams {
  return {
    v3Deposits: deposits,
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

function createStats(strategy: TEnvioLedgerFetchStrategy, rows: number) {
  return {
    byStream: {
      v3Deposits: { pages: 1, rows },
      v3Withdrawals: { pages: 1, rows: 0 },
      v2Deposits: { pages: 1, rows: 0 },
      v2Withdrawals: { pages: 1, rows: 0 },
      transfersIn: { pages: 1, rows: 0 },
      transfersOut: { pages: 1, rows: 0 }
    },
    totalPages: 6,
    totalRows: rows,
    chainCount: 1,
    validationQueries: strategy === 'faceted-batched' ? 1 : 0,
    strategy,
    totalRequests: strategy === 'faceted-batched' ? 2 : 1,
    presenceRequests: strategy === 'faceted-batched' ? 1 : 0,
    batchedRequests: 1,
    continuationRequests: 0
  }
}

function installMocks(): void {
  mocks.acquire.mockResolvedValue({ status: 'acquired', lock: { token: 'worker-a' } })
  mocks.renew.mockResolvedValue({ status: 'ok' })
  mocks.release.mockResolvedValue({ status: 'ok' })
  mocks.read.mockImplementation(() =>
    Promise.resolve(testState.stored ? { status: 'ready', ledger: testState.stored } : { status: 'missing' })
  )
  mocks.fetchMetadata.mockImplementation(() => Promise.resolve(createMetadata()))
  mocks.fetchSource.mockImplementation(
    ({
      lowerBlockByChain,
      strategy
    }: {
      readonly lowerBlockByChain: Readonly<Record<number, number>>
      readonly strategy: TEnvioLedgerFetchStrategy
    }) => {
      testState.lowerBlockByChain = lowerBlockByChain
      testState.strategy = strategy
      const streams = testState.fetchedStreams ?? createStreams()
      return Promise.resolve({
        metadata: createMetadata(),
        windows: [
          {
            chainId: 1,
            lowerBlock: lowerBlockByChain[1] as number,
            upperBlock: testState.metadataProgressBlock
          }
        ],
        streams,
        stats: createStats(strategy, streams.v3Deposits.length)
      })
    }
  )
  mocks.rereadMetadata.mockImplementation(() => Promise.resolve(createMetadata(testState.rereadProgressBlock)))
  mocks.commit.mockImplementation(({ value }: { readonly value: string }) => {
    if (testState.commitStatus === 'ok') {
      testState.stored = decodeWalletLedgerValue(value)
    }
    return Promise.resolve({ status: testState.commitStatus })
  })
}

describe('one-value wallet ledger synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1')
    vi.stubEnv('HOLDINGS_LEDGER_OVERLAP_BLOCKS', '100')
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    testState.stored = null
    testState.metadataProgressBlock = 1_000
    testState.rereadProgressBlock = 1_000
    testState.fetchedStreams = createStreams([createDeposit(100)])
    testState.lowerBlockByChain = null
    testState.strategy = null
    testState.commitStatus = 'ok'
    installMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cold-fetches from the source start and serves a five-minute fresh fast path', async () => {
    const cold = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })

    expect(cold).toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'bootstrap' })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1 })
    expect(testState.strategy).toBe('faceted-batched')
    expect(testState.stored?.coverage).toEqual([
      { chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 1_000 }
    ])
    mocks.fetchMetadata.mockClear()
    mocks.fetchSource.mockClear()

    const fresh = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS - 1
    })

    expect(fresh).toMatchObject({ status: 'ready', outcome: 'fresh', syncType: 'fresh' })
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
    expect(mocks.fetchSource).not.toHaveBeenCalled()
    expect(mocks.acquire).toHaveBeenCalledTimes(1)
  })

  it('warm-merges an overlap and advances zero-event coverage to the original fetched upper bound', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_200
    testState.fetchedStreams = createStreams()

    const warm = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    })

    expect(warm).toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'warm' })
    expect(testState.lowerBlockByChain).toEqual({ 1: 900 })
    expect(testState.strategy).toBe('warm-batched')
    expect(testState.stored?.streams.v3Deposits.map(({ id }) => id)).toEqual(['deposit-100'])
    expect(testState.stored?.coverage[0]?.completeThroughBlock).toBe(1_100)
    expect(testState.stored?.coverage[0]?.completeThroughBlock).not.toBe(1_200)
    expect(warm.status === 'ready' && warm.events.fetched).toBe(0)
  })

  it('bounds the lifetime of a cold wallet value with no events', async () => {
    testState.fetchedStreams = createStreams()

    const result = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })

    expect(result.status === 'ready' && result.events.total).toBe(0)
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ ttlMs: WALLET_LEDGER_EMPTY_TTL_MS }))
  })

  it('deletes cached events missing from the authoritative overlap', async () => {
    testState.fetchedStreams = createStreams([createDeposit(950)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    expect(testState.stored?.streams.v3Deposits).toHaveLength(1)
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()

    const warm = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    })

    expect(warm.status === 'ready' && warm.events.deleted).toBe(1)
    expect(testState.stored?.streams.v3Deposits).toEqual([])
  })

  it('keeps the previous value when the upstream fetch fails', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    testState.metadataProgressBlock = 1_100
    mocks.fetchSource.mockRejectedValueOnce(new Error('Envio source failed'))

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
      })
    ).rejects.toMatchObject({ reasonCode: 'upstream_failed', statusCode: 502 })
    expect(testState.stored).toBe(previous)
    expect(mocks.commit).toHaveBeenCalledTimes(1)
  })

  it('rejects a stale lock commit and keeps the previous value', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()
    testState.commitStatus = 'lock_lost'

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
      })
    ).rejects.toMatchObject({ reasonCode: 'stale_lock', statusCode: 409 })
    expect(testState.stored).toBe(previous)
  })

  it('keeps the previous value when Redis rejects the final write', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()
    mocks.commit.mockRejectedValueOnce(new Error('Redis write failed'))

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
      })
    ).rejects.toMatchObject({ reasonCode: 'storage_failed', statusCode: 500 })
    expect(testState.stored).toBe(previous)
  })

  it('does not invoke the synchronized consumer when another worker owns the lock', async () => {
    mocks.acquire.mockResolvedValueOnce({ status: 'busy' })
    const consume = vi.fn()

    await expect(
      withSynchronizedWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS }, consume)
    ).resolves.toEqual({
      kind: 'busy',
      sync: { status: 'syncing', reasonCode: 'lock_busy' }
    })
    expect(consume).not.toHaveBeenCalled()
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
  })

  it('releases the lock without rewriting a consumer failure', async () => {
    const consumerError = new Error('combined calculation failed')

    await expect(
      withSynchronizedWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS }, async () => {
        throw consumerError
      })
    ).rejects.toBe(consumerError)
    expect(testState.stored).not.toBeNull()
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('reports safe request-correlated stage timings without wallet or event identifiers', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const context = createHoldingsDebugContext('ledger-portfolio-history', USER_ADDRESS, true)

    try {
      await withHoldingsDebugContext(context, () =>
        synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
      )
      const output = consoleLog.mock.calls.map(([message]) => String(message)).join('\n')

      expect(output).toContain('read current wallet ledger value')
      expect(output).toContain('attempted wallet ledger lock acquisition')
      expect(output).toContain('fetched Envio synchronization metadata')
      expect(output).toContain('fetched authoritative Envio event windows')
      expect(output).toContain('merged authoritative wallet event windows')
      expect(output).toContain('encoded complete wallet ledger value')
      expect(output).toContain('committed complete wallet ledger value')
      expect(output).toContain('released wallet ledger lock')
      expect(output).not.toContain(USER_ADDRESS)
      expect(output).not.toContain(VAULT_ADDRESS)
      expect(output).not.toContain(TRANSACTION_HASH)
      expect(output).not.toContain('https://envio.example/graphql')
      expect(output).not.toContain(testState.stored?.revision ?? 'missing-revision')
    } finally {
      consoleLog.mockRestore()
    }
  })
})
