import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoldingsDebugContext, withHoldingsDebugContext } from '@/server/lib/holdings/services/debug'
import type { TEnvioLedgerFetchStrategy, TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import type { TLedgerSixStreams, TLedgerV3DepositSourceEvent } from '@/server/lib/holdings/services/ledger/types'
import { decodeWalletLedgerValue } from '@/server/lib/holdings/services/ledger/walletCodec'
import type { TWalletLedgerInvalidationRecord } from '@/server/lib/holdings/services/ledger/walletInvalidation'
import {
  readVerifiedWalletLedgerHeaderForAddress,
  synchronizeWalletLedger,
  withSynchronizedWalletLedger
} from '@/server/lib/holdings/services/ledger/walletSync'
import {
  type TWalletLedgerCheckedMarkerV2,
  type TWalletLedgerState,
  WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
  WALLET_LEDGER_EMPTY_TTL_MS,
  WALLET_LEDGER_FRESHNESS_MS
} from '@/server/lib/holdings/services/ledger/walletTypes'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'
import type { VaultMetadata } from '@/server/lib/holdings/types'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const INTERMEDIATE_VAULT_ADDRESS = '0x3333333333333333333333333333333333333333'
const NESTED_VAULT_ADDRESS = '0x4444444444444444444444444444444444444444'
const BASE_TOKEN_ADDRESS = '0x5555555555555555555555555555555555555555'
const UNRELATED_VAULT_ADDRESS = '0x6666666666666666666666666666666666666666'
const TRANSACTION_HASH = `0x${'a'.repeat(64)}`
const STARTED_AT_MS = 2_000_000

const testState = vi.hoisted(() => ({
  stored: null as TWalletLedgerState | null,
  checkedMarker: null as TWalletLedgerCheckedMarkerV2 | null,
  metadataProgressBlock: 1_000,
  rereadProgressBlock: 1_000,
  fetchedStreams: null as TLedgerSixStreams | null,
  lowerBlockByChain: null as Readonly<Record<number, number>> | null,
  strategy: null as TEnvioLedgerFetchStrategy | null,
  invalidationRecords: [] as TWalletLedgerInvalidationRecord[],
  invalidationFetchedStreams: null as TLedgerSixStreams | null,
  commitStatus: 'ok' as 'ok' | 'lock_lost',
  markerCommitStatus: 'ok' as 'ok' | 'lock_lost' | 'ledger_changed'
}))

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  renew: vi.fn(),
  release: vi.fn(),
  read: vi.fn(),
  readVerifiedHeader: vi.fn(),
  readCheckedMarker: vi.fn(),
  verifySnapshot: vi.fn(),
  commit: vi.fn(),
  commitCheckedMarker: vi.fn(),
  fetchMetadata: vi.fn(),
  fetchSource: vi.fn(),
  fetchVaultSource: vi.fn(),
  rereadMetadata: vi.fn(),
  readInvalidationHead: vi.fn(),
  readPendingInvalidations: vi.fn(),
  fetchVaultMetadata: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/ledger/walletStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/ledger/walletStore')>()
  return {
    ...original,
    acquireWalletLedgerLock: mocks.acquire,
    renewWalletLedgerLock: mocks.renew,
    releaseWalletLedgerLock: mocks.release,
    readStoredWalletLedger: mocks.read,
    readVerifiedWalletLedgerHeader: mocks.readVerifiedHeader,
    readWalletLedgerCheckedMarker: mocks.readCheckedMarker,
    verifyWalletLedgerSnapshotUnderLock: mocks.verifySnapshot,
    commitStoredWalletLedger: mocks.commit,
    commitWalletLedgerCheckedMarker: mocks.commitCheckedMarker
  }
})

vi.mock('@/server/lib/holdings/services/ledger/envio', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/ledger/envio')>()
  return {
    ...original,
    fetchEnvioLedgerMetadata: mocks.fetchMetadata,
    fetchEnvioLedgerSource: mocks.fetchSource,
    fetchEnvioLedgerVaultStreams: mocks.fetchVaultSource,
    rereadEnvioLedgerMetadata: mocks.rereadMetadata
  }
})

vi.mock('@/server/lib/holdings/services/ledger/walletInvalidation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/ledger/walletInvalidation')>()
  return {
    ...original,
    readWalletLedgerInvalidationHead: mocks.readInvalidationHead,
    readPendingWalletLedgerInvalidations: mocks.readPendingInvalidations
  }
})

vi.mock('@/server/lib/holdings/services/vaults', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/lib/holdings/services/vaults')>()
  return {
    ...original,
    fetchMultipleVaultsMetadata: mocks.fetchVaultMetadata
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

function createCheckedMarker(
  ledger: TWalletLedgerState,
  checkedAtMs: number,
  reconciledAtMs: number,
  coverage: TWalletLedgerCheckedMarkerV2['coverage'] = ledger.coverage,
  coveredAtMs = ledger.updatedAtMs
): TWalletLedgerCheckedMarkerV2 {
  const eventCount = Object.values(ledger.streams).reduce((total, events) => total + events.length, 0)
  return {
    schemaVersion: WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
    revision: ledger.revision,
    eventRevision: ledger.eventRevision,
    calculationVersion: ledger.calculationVersion,
    sourceGeneration: ledger.sourceGeneration,
    appliedInvalidationSequence: ledger.appliedInvalidationSequence,
    updatedAtMs: ledger.updatedAtMs,
    coveredAtMs,
    eventCount,
    hasActivity: eventCount > 0,
    encodedBytes: ledger.encodedBytes,
    decodedBytes: ledger.decodedBytes,
    checkedAtMs,
    reconciledAtMs,
    coverage
  }
}

function createInvalidationRecord(fromBlock = 1, address = VAULT_ADDRESS): TWalletLedgerInvalidationRecord {
  return {
    schemaVersion: 1,
    createdAtMs: STARTED_AT_MS + 1,
    vaults: [{ chainId: 1, address, fromBlock }]
  }
}

function createVaultMetadata(address: string, tokenAddress: string): VaultMetadata {
  return {
    address,
    chainId: 1,
    version: 'v3',
    isHidden: false,
    category: 'volatile',
    token: { address: tokenAddress, symbol: 'TEST', decimals: 18 },
    decimals: 18
  }
}

function createVaultMetadataResult(
  vaults: Array<{ readonly chainId: number; readonly vaultAddress: string }>,
  hierarchy: ReadonlyMap<string, VaultMetadata> = new Map([
    [VAULT_ADDRESS, createVaultMetadata(VAULT_ADDRESS, BASE_TOKEN_ADDRESS)]
  ])
): Map<string, VaultMetadata> {
  return new Map(
    vaults.flatMap(({ chainId, vaultAddress }) => {
      const metadata = hierarchy.get(vaultAddress.toLowerCase())
      return metadata ? [[`${chainId}:${vaultAddress.toLowerCase()}`, metadata] as const] : []
    })
  )
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
  mocks.readCheckedMarker.mockImplementation(() =>
    Promise.resolve(
      testState.checkedMarker ? { status: 'ready', marker: testState.checkedMarker } : { status: 'missing' }
    )
  )
  mocks.readVerifiedHeader.mockResolvedValue({ status: 'missing' })
  mocks.verifySnapshot.mockImplementation(({ expectedRevision }: { readonly expectedRevision: string | null }) => {
    const revisionMatches =
      expectedRevision === null ? testState.stored === null : testState.stored?.revision === expectedRevision
    if (!revisionMatches) {
      return Promise.resolve({ status: 'changed' })
    }
    return Promise.resolve({
      status: 'unchanged',
      marker: testState.checkedMarker ? { status: 'ready', marker: testState.checkedMarker } : { status: 'missing' }
    })
  })
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
  mocks.readInvalidationHead.mockImplementation(() => Promise.resolve(testState.invalidationRecords.length))
  mocks.readPendingInvalidations.mockImplementation(({ appliedSequence }: { readonly appliedSequence: number }) =>
    Promise.resolve({
      status: 'ready',
      headSequence: testState.invalidationRecords.length,
      records: testState.invalidationRecords.slice(appliedSequence)
    })
  )
  mocks.fetchVaultSource.mockImplementation(() => {
    const streams = testState.invalidationFetchedStreams ?? createStreams()
    return Promise.resolve({ streams, stats: createStats('warm-batched', streams.v3Deposits.length) })
  })
  mocks.fetchVaultMetadata.mockImplementation(
    (vaults: Array<{ readonly chainId: number; readonly vaultAddress: string }>) =>
      Promise.resolve(createVaultMetadataResult(vaults))
  )
  mocks.commit.mockImplementation(
    ({
      value,
      checkedAtMs,
      effectiveReconciledAtMs
    }: {
      readonly value: string
      readonly checkedAtMs: number
      readonly effectiveReconciledAtMs: number
    }) => {
      if (testState.commitStatus === 'ok') {
        testState.stored = decodeWalletLedgerValue(value)
        testState.checkedMarker = createCheckedMarker(testState.stored, checkedAtMs, effectiveReconciledAtMs)
      }
      return Promise.resolve({ status: testState.commitStatus })
    }
  )
  mocks.commitCheckedMarker.mockImplementation(
    ({
      ledger,
      checkedAtMs,
      effectiveReconciledAtMs,
      coverage,
      coveredAtMs
    }: {
      readonly ledger: TWalletLedgerState
      readonly checkedAtMs: number
      readonly effectiveReconciledAtMs: number
      readonly coverage: TWalletLedgerCheckedMarkerV2['coverage']
      readonly coveredAtMs: number
    }) => {
      if (testState.markerCommitStatus === 'ok') {
        testState.checkedMarker = createCheckedMarker(
          ledger,
          checkedAtMs,
          effectiveReconciledAtMs,
          coverage,
          coveredAtMs
        )
      }
      return Promise.resolve({ status: testState.markerCommitStatus })
    }
  )
}

describe('one-value wallet ledger synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1')
    vi.stubEnv('HOLDINGS_LEDGER_OVERLAP_BLOCKS', '100')
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    testState.stored = null
    testState.checkedMarker = null
    testState.metadataProgressBlock = 1_000
    testState.rereadProgressBlock = 1_000
    testState.fetchedStreams = createStreams([createDeposit(100)])
    testState.lowerBlockByChain = null
    testState.strategy = null
    testState.invalidationRecords = []
    testState.invalidationFetchedStreams = null
    testState.commitStatus = 'ok'
    testState.markerCommitStatus = 'ok'
    installMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cold-fetches from the source start and serves a five-minute fresh fast path', async () => {
    const cold = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })

    expect(cold).toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'bootstrap' })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1 })
    expect(testState.strategy).toBe('cold-batched')
    expect(testState.stored?.coverage).toEqual([
      { chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 1_000 }
    ])
    expect(testState.stored?.reconciledAtMs).toBe(STARTED_AT_MS)
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        releaseLockOnSuccess: true,
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: true, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
    expect(mocks.release).not.toHaveBeenCalled()
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
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('reuses the preliminary decoded ledger after atomically verifying it under the acquired lock', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    mocks.read.mockClear()
    mocks.readCheckedMarker.mockClear()
    mocks.verifySnapshot.mockClear()
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()

    await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    })

    expect(mocks.verifySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: testState.stored?.revision })
    )
    expect(mocks.read).toHaveBeenCalledTimes(1)
    expect(mocks.readCheckedMarker).toHaveBeenCalledTimes(1)
  })

  it('rereads the wallet ledger when its revision changes before lock acquisition', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    mocks.read.mockClear()
    mocks.readCheckedMarker.mockClear()
    mocks.verifySnapshot.mockResolvedValueOnce({ status: 'changed' })
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()

    await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    })

    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.readCheckedMarker).toHaveBeenCalledTimes(2)
  })

  it('fails closed when lock ownership is lost during snapshot verification', async () => {
    mocks.verifySnapshot.mockResolvedValueOnce({ status: 'lock_lost' })

    await expect(synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })).rejects.toMatchObject({
      reasonCode: 'stale_lock',
      statusCode: 409
    })
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('starts targeted vault metadata prefetch before persistence without blocking synchronization', async () => {
    const metadataResult = createDeferred<Map<string, VaultMetadata>>()
    mocks.fetchVaultMetadata.mockReturnValueOnce(metadataResult.promise)

    try {
      const cold = await synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS,
        prefetchVaultMetadata: true
      })

      expect(cold).toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'bootstrap' })
      expect(mocks.fetchVaultMetadata).toHaveBeenCalledWith([{ chainId: 1, vaultAddress: VAULT_ADDRESS }])
      expect(mocks.fetchVaultMetadata.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.commit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
      )
    } finally {
      metadataResult.resolve(new Map())
      await metadataResult.promise
    }
  })

  it('overlaps source revalidation with local ledger preparation but awaits it before persistence', async () => {
    const revalidation = createDeferred<readonly TEnvioLedgerMetadata[]>()
    const onVaultsDiscovered = vi.fn()
    mocks.rereadMetadata.mockReturnValueOnce(revalidation.promise)

    const synchronization = synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS,
      onVaultsDiscovered
    })

    try {
      await vi.waitFor(() => expect(mocks.rereadMetadata).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(onVaultsDiscovered).toHaveBeenCalledTimes(1))
      expect(mocks.commit).not.toHaveBeenCalled()
      expect(mocks.rereadMetadata.mock.invocationCallOrder[0]).toBeLessThan(
        onVaultsDiscovered.mock.invocationCallOrder[0] as number
      )
    } finally {
      revalidation.resolve(createMetadata())
    }

    await expect(synchronization).resolves.toMatchObject({ status: 'ready', outcome: 'updated' })
    expect(mocks.commit).toHaveBeenCalledTimes(1)
    expect(onVaultsDiscovered.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.commit.mock.invocationCallOrder[0] as number
    )
  })

  it('does not persist speculative ledger preparation when source revalidation fails', async () => {
    const onVaultsDiscovered = vi.fn()
    mocks.rereadMetadata.mockRejectedValueOnce(new Error('Envio metadata changed'))

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS,
        onVaultsDiscovered
      })
    ).rejects.toMatchObject({ reasonCode: 'upstream_failed', statusCode: 502 })

    expect(onVaultsDiscovered).toHaveBeenCalledTimes(1)
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(testState.stored).toBeNull()
  })

  it('reports discovered vaults before persistence without awaiting callback work', async () => {
    const callbackResult = createDeferred<void>()
    const onVaultsDiscovered = vi.fn(() => callbackResult.promise)

    try {
      const cold = await synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS,
        onVaultsDiscovered
      })

      expect(cold).toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'bootstrap' })
      expect(onVaultsDiscovered).toHaveBeenCalledWith([{ chainId: 1, vaultAddress: VAULT_ADDRESS }])
      expect(onVaultsDiscovered.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.commit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
      )
    } finally {
      callbackResult.resolve()
      await callbackResult.promise
    }
  })

  it('does not fail synchronization when a vault discovery callback fails synchronously or asynchronously', async () => {
    const onVaultsDiscovered = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('prefetch failed')
      })
      .mockRejectedValueOnce(new Error('async prefetch failed'))

    await expect(
      synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS, onVaultsDiscovered })
    ).resolves.toMatchObject({ status: 'ready', outcome: 'updated', syncType: 'bootstrap' })
    await expect(
      synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS, onVaultsDiscovered })
    ).resolves.toMatchObject({ status: 'ready', outcome: 'fresh', syncType: 'fresh' })
    await Promise.resolve()

    expect(onVaultsDiscovered).toHaveBeenCalledTimes(2)
    expect(mocks.commit).toHaveBeenCalledTimes(1)
  })

  it('dates freshness from verification completion instead of request start', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(STARTED_AT_MS)
    const fetchSource = mocks.fetchSource.getMockImplementation()
    if (!fetchSource) {
      throw new Error('Expected source fetch mock')
    }
    mocks.fetchSource.mockImplementation(async (...args: unknown[]) => {
      const fetched = await fetchSource(...args)
      vi.setSystemTime(STARTED_AT_MS + 10_000)
      return fetched
    })

    try {
      await synchronizeWalletLedger({ address: USER_ADDRESS })

      expect(testState.stored?.updatedAtMs).toBe(STARTED_AT_MS)
      expect(testState.checkedMarker?.checkedAtMs).toBe(STARTED_AT_MS + 10_000)
      expect(testState.checkedMarker?.reconciledAtMs).toBe(STARTED_AT_MS + 10_000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('advances zero-event coverage in the checked marker without rewriting the complete ledger', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    mocks.commit.mockClear()
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_200
    testState.fetchedStreams = createStreams()

    const warm = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    })

    expect(warm).toMatchObject({ status: 'ready', outcome: 'unchanged', syncType: 'warm' })
    expect(testState.lowerBlockByChain).toEqual({ 1: 900 })
    expect(testState.strategy).toBe('warm-batched')
    expect(testState.stored?.streams.v3Deposits.map(({ id }) => id)).toEqual(['deposit-100'])
    expect(testState.stored).toBe(previous)
    expect(testState.stored?.coverage[0]?.completeThroughBlock).toBe(1_000)
    expect(testState.checkedMarker?.coverage[0]?.completeThroughBlock).toBe(1_100)
    expect(testState.checkedMarker?.coverage[0]?.completeThroughBlock).not.toBe(1_200)
    expect(testState.stored?.reconciledAtMs).toBe(STARTED_AT_MS)
    expect(warm.status === 'ready' && warm.events.fetched).toBe(0)
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(mocks.commitCheckedMarker).toHaveBeenCalledWith(
      expect.objectContaining({
        coverage: createMetadata(1_100).map(({ chainId, startBlock, endBlock, progressBlock }) => ({
          chainId,
          startBlock,
          endBlock,
          completeThroughBlock: progressBlock
        }))
      })
    )

    mocks.commitCheckedMarker.mockClear()
    testState.metadataProgressBlock = 1_200
    testState.rereadProgressBlock = 1_200
    await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS * 2
    })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1_000 })
    expect(testState.checkedMarker?.coverage[0]?.completeThroughBlock).toBe(1_200)
  })

  it('refreshes an unchanged expired ledger by committing only its checked marker', async () => {
    testState.fetchedStreams = createStreams([createDeposit(950)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    const previousRevision = previous?.revision
    mocks.commit.mockClear()
    mocks.commitCheckedMarker.mockClear()
    testState.fetchedStreams = createStreams([createDeposit(950)])

    const verifiedAtMs = STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: verifiedAtMs })

    expect(checked).toMatchObject({ status: 'ready', outcome: 'unchanged', syncType: 'warm' })
    expect(testState.stored).toBe(previous)
    expect(testState.stored?.revision).toBe(previousRevision)
    expect(testState.checkedMarker).toMatchObject({
      revision: previousRevision,
      checkedAtMs: verifiedAtMs,
      reconciledAtMs: STARTED_AT_MS,
      coverage: previous?.coverage
    })
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(mocks.commitCheckedMarker).toHaveBeenCalledWith(expect.objectContaining({ releaseLockOnSuccess: true }))
    expect(mocks.release).not.toHaveBeenCalled()

    mocks.fetchMetadata.mockClear()
    mocks.fetchSource.mockClear()
    const fresh = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      nowMs: verifiedAtMs + WALLET_LEDGER_FRESHNESS_MS - 1
    })
    expect(fresh).toMatchObject({ status: 'ready', outcome: 'fresh', syncType: 'fresh' })
    expect(mocks.fetchMetadata).not.toHaveBeenCalled()
    expect(mocks.fetchSource).not.toHaveBeenCalled()
  })

  it('fails closed when marker coverage regresses or its source contract differs', async () => {
    testState.fetchedStreams = createStreams([createDeposit(950)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const stored = testState.stored
    if (!stored) {
      throw new Error('Expected stored wallet ledger')
    }

    testState.checkedMarker = createCheckedMarker(stored, STARTED_AT_MS + 1, STARTED_AT_MS, [
      { ...stored.coverage[0]!, completeThroughBlock: stored.coverage[0]!.completeThroughBlock - 1 }
    ])
    mocks.fetchMetadata.mockClear()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 2 })
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)

    testState.checkedMarker = createCheckedMarker(stored, STARTED_AT_MS + 3, STARTED_AT_MS, [
      { ...stored.coverage[0]!, startBlock: stored.coverage[0]!.startBlock + 1 }
    ])
    mocks.fetchMetadata.mockClear()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 4 })
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)
  })

  it('awaits a separate release when an atomic checked-marker commit loses its CAS', async () => {
    testState.fetchedStreams = createStreams([createDeposit(950)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.markerCommitStatus = 'ledger_changed'

    await expect(
      synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS })
    ).rejects.toMatchObject({ reasonCode: 'stale_lock', statusCode: 409 })

    expect(mocks.commitCheckedMarker).toHaveBeenLastCalledWith(expect.objectContaining({ releaseLockOnSuccess: true }))
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('fails closed and performs normal synchronization when the checked marker is missing or future-dated', async () => {
    testState.fetchedStreams = createStreams([createDeposit(950)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const revision = testState.stored?.revision
    testState.checkedMarker = null
    mocks.fetchMetadata.mockClear()

    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)
    expect(mocks.commitCheckedMarker).toHaveBeenCalledTimes(1)

    if (!testState.stored || revision === undefined) {
      throw new Error('Expected stored wallet ledger')
    }
    testState.checkedMarker = createCheckedMarker(testState.stored, STARTED_AT_MS + 100, STARTED_AT_MS)
    mocks.fetchMetadata.mockClear()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 2 })
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)
  })

  it('runs a full no-presence reconciliation when the durable reconciliation interval expires', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS', '10')
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previousEventRevision = testState.stored?.eventRevision
    testState.fetchedStreams = createStreams([createDeposit(100)])
    mocks.fetchMetadata.mockClear()
    mocks.fetchSource.mockClear()

    const reconciled = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 10_000 })

    expect(reconciled).toMatchObject({
      status: 'ready',
      outcome: 'unchanged',
      syncType: 'reconcile',
      ledger: {
        eventRevision: previousEventRevision,
        reconciledAtMs: STARTED_AT_MS + 10_000,
        sourceGeneration: 1
      },
      transition: { dirtyFromTimestamp: null }
    })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1 })
    expect(testState.strategy).toBe('cold-batched')
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)
    expect(mocks.fetchSource).toHaveBeenCalledTimes(1)
    expect(mocks.commitCheckedMarker).not.toHaveBeenCalled()
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([expect.objectContaining({ reset: false, dirtyFromDate: null })])
      })
    )
  })

  it('dirties historical totals from the earliest event changed by reconciliation', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS', '10')
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const backfilled = createDeposit(50)
    testState.fetchedStreams = createStreams([backfilled, createDeposit(100)])

    const reconciled = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 10_000 })

    expect(reconciled).toMatchObject({
      status: 'ready',
      syncType: 'reconcile',
      transition: { dirtyFromTimestamp: backfilled.blockTimestamp }
    })
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: false, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
  })

  it('dirties a directly invalidated vault when its full reconciliation is otherwise unchanged', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS', '10')
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.invalidationRecords = [createInvalidationRecord()]
    testState.fetchedStreams = createStreams([createDeposit(100)])
    mocks.fetchVaultSource.mockClear()

    const reconciled = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 10_000 })

    expect(reconciled).toMatchObject({
      status: 'ready',
      syncType: 'reconcile',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { previousAppliedInvalidationSequence: 0, dirtyFromTimestamp: 1_000 }
    })
    expect(mocks.fetchVaultSource).not.toHaveBeenCalled()
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: false, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
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

  it('bypasses the five-minute fast path and repairs a newly indexed vault event', async () => {
    testState.fetchedStreams = createStreams()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.invalidationRecords = [createInvalidationRecord()]
    testState.invalidationFetchedStreams = createStreams([createDeposit(100)])
    mocks.fetchMetadata.mockClear()
    mocks.fetchVaultSource.mockClear()

    const repaired = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(repaired).toMatchObject({
      status: 'ready',
      syncType: 'warm',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { previousAppliedInvalidationSequence: 0, dirtyFromTimestamp: 1_000 }
    })
    expect(mocks.fetchMetadata).toHaveBeenCalledTimes(1)
    expect(mocks.fetchVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USER_ADDRESS,
        windows: [
          expect.objectContaining({
            chainId: 1,
            lowerBlock: 1,
            upperBlock: 1_000,
            vaultAddresses: [VAULT_ADDRESS]
          })
        ]
      })
    )
    expect(repaired.status === 'ready' && repaired.ledger.streams.v3Deposits).toEqual([createDeposit(100)])
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: false, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
  })

  it('advances the invalidation sequence after a targeted query finds no wallet event', async () => {
    testState.fetchedStreams = createStreams()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.invalidationRecords = [createInvalidationRecord()]
    testState.invalidationFetchedStreams = createStreams()
    mocks.fetchVaultSource.mockClear()

    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(checked).toMatchObject({
      status: 'ready',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { previousAppliedInvalidationSequence: 0, dirtyFromTimestamp: null }
    })
    expect(mocks.fetchVaultSource).toHaveBeenCalledTimes(1)
  })

  it('dirties an outer vault when a nested vault dependency is invalidated', async () => {
    const existing = createDeposit(100)
    testState.fetchedStreams = createStreams([existing])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const hierarchy = new Map([
      [VAULT_ADDRESS, createVaultMetadata(VAULT_ADDRESS, INTERMEDIATE_VAULT_ADDRESS)],
      [INTERMEDIATE_VAULT_ADDRESS, createVaultMetadata(INTERMEDIATE_VAULT_ADDRESS, NESTED_VAULT_ADDRESS)],
      [NESTED_VAULT_ADDRESS, createVaultMetadata(NESTED_VAULT_ADDRESS, BASE_TOKEN_ADDRESS)]
    ])
    mocks.fetchVaultMetadata.mockImplementation(
      (vaults: Array<{ readonly chainId: number; readonly vaultAddress: string }>) =>
        Promise.resolve(createVaultMetadataResult(vaults, hierarchy))
    )
    testState.invalidationRecords = [createInvalidationRecord(1, NESTED_VAULT_ADDRESS)]
    testState.fetchedStreams = createStreams()
    testState.invalidationFetchedStreams = createStreams()

    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(checked).toMatchObject({
      status: 'ready',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { dirtyFromTimestamp: existing.blockTimestamp }
    })
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: false, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
  })

  it('preserves historical totals when an unrelated vault is invalidated', async () => {
    const existing = createDeposit(100)
    testState.fetchedStreams = createStreams([existing])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const hierarchy = new Map([
      [VAULT_ADDRESS, createVaultMetadata(VAULT_ADDRESS, INTERMEDIATE_VAULT_ADDRESS)],
      [INTERMEDIATE_VAULT_ADDRESS, createVaultMetadata(INTERMEDIATE_VAULT_ADDRESS, NESTED_VAULT_ADDRESS)],
      [NESTED_VAULT_ADDRESS, createVaultMetadata(NESTED_VAULT_ADDRESS, BASE_TOKEN_ADDRESS)]
    ])
    mocks.fetchVaultMetadata.mockImplementation(
      (vaults: Array<{ readonly chainId: number; readonly vaultAddress: string }>) =>
        Promise.resolve(createVaultMetadataResult(vaults, hierarchy))
    )
    testState.invalidationRecords = [createInvalidationRecord(1, UNRELATED_VAULT_ADDRESS)]
    testState.fetchedStreams = createStreams()
    testState.invalidationFetchedStreams = createStreams()

    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(checked).toMatchObject({
      status: 'ready',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { dirtyFromTimestamp: null }
    })
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([expect.objectContaining({ reset: false, dirtyFromDate: null })])
      })
    )
  })

  it('conservatively dirties the whole wallet history when dependency metadata fails', async () => {
    const existing = createDeposit(100)
    testState.fetchedStreams = createStreams([existing])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    mocks.fetchVaultMetadata.mockRejectedValue(new Error('metadata unavailable'))
    testState.invalidationRecords = [createInvalidationRecord(1, UNRELATED_VAULT_ADDRESS)]
    testState.fetchedStreams = createStreams()
    testState.invalidationFetchedStreams = createStreams()

    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(checked).toMatchObject({
      status: 'ready',
      ledger: { appliedInvalidationSequence: 1 },
      transition: { dirtyFromTimestamp: existing.blockTimestamp }
    })
    expect(mocks.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cacheTransitions: expect.arrayContaining([
          expect.objectContaining({ reset: false, dirtyFromDate: '1970-01-01' })
        ])
      })
    )
  })

  it('dirties from a deleted historical event even when the targeted source returns no row', async () => {
    testState.fetchedStreams = createStreams([createDeposit(100)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.invalidationRecords = [createInvalidationRecord()]
    testState.fetchedStreams = createStreams()
    testState.invalidationFetchedStreams = createStreams()

    const repaired = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(repaired).toMatchObject({
      status: 'ready',
      events: { deleted: 1 },
      transition: { dirtyFromTimestamp: 1_000 }
    })
    expect(repaired.status === 'ready' && repaired.ledger.streams.v3Deposits).toEqual([])
  })

  it('dirties an invalidated vault from its earliest matching event when event bytes are unchanged', async () => {
    const existing = createDeposit(100)
    testState.fetchedStreams = createStreams([existing])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previousEventRevision = testState.stored?.eventRevision
    testState.invalidationRecords = [createInvalidationRecord()]
    testState.fetchedStreams = createStreams()
    testState.invalidationFetchedStreams = createStreams([existing])

    const checked = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(checked).toMatchObject({
      status: 'ready',
      ledger: { eventRevision: previousEventRevision },
      transition: { previousEventRevision, dirtyFromTimestamp: existing.blockTimestamp }
    })
  })

  it('falls back to a full rebuild when the invalidation log no longer covers the wallet cursor', async () => {
    testState.fetchedStreams = createStreams()
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    testState.stored = testState.stored ? { ...testState.stored, appliedInvalidationSequence: 1 } : null
    mocks.readInvalidationHead.mockResolvedValue(0)
    mocks.readPendingInvalidations.mockResolvedValueOnce({ status: 'gap', headSequence: 0 })

    const rebuilt = await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS + 1 })

    expect(rebuilt).toMatchObject({
      status: 'ready',
      syncType: 'forced-reset',
      ledger: { appliedInvalidationSequence: 0, sourceGeneration: 2 }
    })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1 })
    expect(testState.strategy).toBe('cold-batched')
    expect(mocks.fetchVaultSource).not.toHaveBeenCalled()
  })

  it('advances the durable source generation for an explicit forced rebuild', async () => {
    testState.fetchedStreams = createStreams([createDeposit(100)])
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })

    const rebuilt = await synchronizeWalletLedger({
      address: USER_ADDRESS,
      forceRebuild: true,
      nowMs: STARTED_AT_MS + 1
    })

    expect(rebuilt).toMatchObject({
      status: 'ready',
      syncType: 'forced-reset',
      ledger: { sourceGeneration: 2 }
    })
    expect(testState.lowerBlockByChain).toEqual({ 1: 1 })
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
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('rejects a stale lock commit and keeps the previous value', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()
    testState.markerCommitStatus = 'lock_lost'

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
      })
    ).rejects.toMatchObject({ reasonCode: 'stale_lock', statusCode: 409 })
    expect(testState.stored).toBe(previous)
    expect(mocks.commitCheckedMarker).toHaveBeenLastCalledWith(expect.objectContaining({ releaseLockOnSuccess: true }))
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('renews lock ownership immediately before the final commit', async () => {
    mocks.renew.mockResolvedValueOnce({ status: 'lock_lost' })

    await expect(synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })).rejects.toMatchObject({
      reasonCode: 'stale_lock',
      statusCode: 409
    })
    expect(mocks.renew).toHaveBeenCalledTimes(1)
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(testState.stored).toBeNull()
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous value when Redis rejects the final write', async () => {
    await synchronizeWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS })
    const previous = testState.stored
    testState.metadataProgressBlock = 1_100
    testState.rereadProgressBlock = 1_100
    testState.fetchedStreams = createStreams()
    mocks.commitCheckedMarker.mockRejectedValueOnce(new Error('Redis write failed'))

    await expect(
      synchronizeWalletLedger({
        address: USER_ADDRESS,
        nowMs: STARTED_AT_MS + WALLET_LEDGER_FRESHNESS_MS
      })
    ).rejects.toMatchObject({ reasonCode: 'storage_failed', statusCode: 500 })
    expect(testState.stored).toBe(previous)
    expect(mocks.release).toHaveBeenCalledTimes(1)
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

  it('reads the verified lightweight header without decoding the wallet ledger', async () => {
    mocks.readVerifiedHeader.mockResolvedValueOnce({ status: 'ready', header: { revision: 'header-revision' } })

    await expect(readVerifiedWalletLedgerHeaderForAddress({ address: USER_ADDRESS })).resolves.toEqual({
      status: 'ready',
      header: { revision: 'header-revision' }
    })
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.readVerifiedHeader).toHaveBeenCalledWith({
      redis: { marker: 'wallet-ledger-redis' },
      walletHash: hashLedgerWalletAddress(USER_ADDRESS)
    })
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

  it('keeps the lock through a synchronized consumer and releases it afterward', async () => {
    const consume = vi.fn().mockResolvedValue('calculated')

    await expect(
      withSynchronizedWalletLedger({ address: USER_ADDRESS, nowMs: STARTED_AT_MS }, consume)
    ).resolves.toMatchObject({ kind: 'completed', consumed: 'calculated' })

    expect(mocks.commit).toHaveBeenLastCalledWith(expect.objectContaining({ releaseLockOnSuccess: false }))
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(consume.mock.invocationCallOrder[0] as number)
    expect(consume.mock.invocationCallOrder[0]).toBeLessThan(mocks.release.mock.invocationCallOrder[0] as number)
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
      expect(output).toContain('released_atomically')
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
