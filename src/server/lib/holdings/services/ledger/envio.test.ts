import { getAddress } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEnvioLedgerChainWindows,
  ENVIO_LEDGER_MAX_FETCHED_DECODED_BYTES,
  ENVIO_LEDGER_MAX_FETCHED_ROWS,
  ENVIO_LEDGER_MAX_RESPONSE_BYTES,
  ENVIO_LEDGER_PAGE_SIZE,
  fetchEnvioLedgerMetadata,
  fetchEnvioLedgerSource,
  fetchEnvioLedgerStreams,
  rereadEnvioLedgerMetadata,
  type TEnvioLedgerMetadata
} from '@/server/lib/holdings/services/ledger/envio'

const USER = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
const CHECKSUM_USER = getAddress(USER)
const VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'
const TRANSACTION_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

interface TGraphqlRequestBody {
  readonly query: string
  readonly variables: Record<string, unknown>
}

function createGraphqlResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function parseRequestBody(init: RequestInit | undefined): TGraphqlRequestBody {
  return JSON.parse(String(init?.body ?? '{}')) as TGraphqlRequestBody
}

function createMetadata(chainId: number, overrides: Partial<TEnvioLedgerMetadata> = {}): TEnvioLedgerMetadata {
  return {
    chainId,
    progressBlock: 1_000,
    eventsProcessed: 10_000,
    bufferBlock: 1_005,
    firstEventBlock: 100,
    sourceBlock: 1_010,
    readyAt: '2026-08-06T00:00:00.000Z',
    isReady: true,
    startBlock: 100,
    endBlock: null,
    ...overrides
  }
}

function createBaseEvent(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    vaultAddress: VAULT,
    chainId: 1,
    blockNumber: 150,
    blockTimestamp: 1_000,
    logIndex: 4,
    transactionHash: TRANSACTION_HASH,
    transactionFrom: COUNTERPARTY,
    ...overrides
  }
}

function createV3Deposit(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createBaseEvent(id),
    owner: USER,
    sender: USER,
    assets: '100',
    shares: '90',
    ...overrides
  }
}

function createV3Withdrawal(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createBaseEvent(id),
    owner: USER,
    assets: '80',
    shares: '70',
    ...overrides
  }
}

function createV2Deposit(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createBaseEvent(id),
    recipient: USER,
    amount: '60',
    shares: '50',
    ...overrides
  }
}

function createV2Withdrawal(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createBaseEvent(id),
    recipient: USER,
    amount: '40',
    shares: '30',
    ...overrides
  }
}

function createTransfer(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createBaseEvent(id),
    sender: COUNTERPARTY,
    receiver: USER,
    value: '20',
    ...overrides
  }
}

function getEntityResult(query: string): Record<string, unknown> {
  if (query.includes('LedgerV3Deposits')) {
    return { Deposit: [createV3Deposit('v3-deposit')] }
  }
  if (query.includes('LedgerV3Withdrawals')) {
    return { Withdraw: [createV3Withdrawal('v3-withdrawal')] }
  }
  if (query.includes('LedgerV2Deposits')) {
    return { V2Deposit: [createV2Deposit('v2-deposit')] }
  }
  if (query.includes('LedgerV2Withdrawals')) {
    return { V2Withdraw: [createV2Withdrawal('v2-withdrawal')] }
  }
  if (query.includes('LedgerTransfersIn')) {
    return { Transfer: [createTransfer('transfer-in')] }
  }
  if (query.includes('LedgerTransfersOut')) {
    return {
      Transfer: [createTransfer('transfer-out', { sender: USER, receiver: COUNTERPARTY })]
    }
  }
  throw new Error('Unexpected test query')
}

describe('Envio ledger source', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('validates metadata, keeps only supported chains, and creates inclusive windows', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.invalid/graphql')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        expect(body.query).toContain('query LedgerIndexerMeta')
        expect(body.query).toContain('progressBlock')
        expect(body.query).toContain('eventsProcessed')
        expect(body.variables).toEqual({})
        return createGraphqlResponse({
          _meta: [
            createMetadata(80_094),
            createMetadata(42_161, { startBlock: 500, progressBlock: 2_000 }),
            createMetadata(1)
          ]
        })
      })
    )

    const metadata = await fetchEnvioLedgerMetadata()
    const windows = createEnvioLedgerChainWindows(metadata, { 1: 50, 42161: 1_500 })

    expect(metadata.map(({ chainId }) => chainId)).toEqual([1, 42_161])
    expect(windows).toEqual([
      { chainId: 1, lowerBlock: 100, upperBlock: 1_000 },
      { chainId: 42_161, lowerBlock: 1_500, upperBlock: 2_000 }
    ])
  })

  it('rejects malformed or duplicate metadata with a fixed error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createGraphqlResponse({
          _meta: [createMetadata(1), createMetadata(1, { progressBlock: 2_000 })]
        })
      )
    )

    await expect(fetchEnvioLedgerMetadata()).rejects.toThrow('Envio ledger source metadata is invalid')
  })

  it('pins a lagging indexer chain to its transactionally written progress block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createGraphqlResponse({
          _meta: [createMetadata(1, { isReady: false, readyAt: null })]
        })
      )
    )

    const metadata = await fetchEnvioLedgerMetadata()

    expect(metadata).toEqual([expect.objectContaining({ chainId: 1, isReady: false, progressBlock: 1_000 })])
    expect(createEnvioLedgerChainWindows(metadata)).toEqual([{ chainId: 1, lowerBlock: 100, upperBlock: 1_000 }])
  })

  it('re-reads metadata and rejects a checkpoint regression', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createGraphqlResponse({
          _meta: [createMetadata(1, { progressBlock: 999 })]
        })
      )
    )

    await expect(rereadEnvioLedgerMetadata([createMetadata(1)])).rejects.toThrow(
      'Envio ledger source metadata changed during synchronization'
    )
  })

  it('re-validates only the explicitly expected chain subset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createGraphqlResponse({
          _meta: [createMetadata(1, { progressBlock: 1_001 }), createMetadata(10)]
        })
      )
    )

    await expect(rereadEnvioLedgerMetadata([createMetadata(1)])).resolves.toEqual([
      expect.objectContaining({ chainId: 1, progressBlock: 1_001 })
    ])
  })

  it('allows throttled metadata to advance but rejects configuration changes during synchronization', async () => {
    const expected = createMetadata(1)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          createGraphqlResponse({
            _meta: [
              {
                ...expected,
                bufferBlock: Number(expected.bufferBlock) + 10,
                firstEventBlock: Number(expected.firstEventBlock) - 1,
                sourceBlock: Number(expected.sourceBlock) + 10,
                readyAt: null,
                isReady: false
              }
            ]
          })
        )
        .mockResolvedValueOnce(createGraphqlResponse({ _meta: [{ ...expected, startBlock: expected.startBlock + 1 }] }))
    )

    await expect(rereadEnvioLedgerMetadata([expected])).resolves.toHaveLength(1)
    await expect(rereadEnvioLedgerMetadata([expected])).rejects.toThrow(
      'Envio ledger source metadata changed during synchronization'
    )
  })

  it('queries checksum addresses while accepting differently cased rows for all six raw streams', async () => {
    const requests: TGraphqlRequestBody[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        requests.push(body)
        return createGraphqlResponse(getEntityResult(body.query))
      })
    )

    const result = await fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])

    expect(result.streams.v3Deposits[0]?.id).toBe('v3-deposit')
    expect(result.streams.v3Withdrawals[0]?.id).toBe('v3-withdrawal')
    expect(result.streams.v2Deposits[0]).toEqual(expect.objectContaining({ id: 'v2-deposit', amount: '60' }))
    expect(result.streams.v2Withdrawals[0]).toEqual(expect.objectContaining({ id: 'v2-withdrawal', amount: '40' }))
    expect(result.streams.transfersIn[0]?.id).toBe('transfer-in')
    expect(result.streams.transfersOut[0]?.id).toBe('transfer-out')
    expect(result.stats).toEqual({
      byStream: {
        v3Deposits: { pages: 1, rows: 1 },
        v3Withdrawals: { pages: 1, rows: 1 },
        v2Deposits: { pages: 1, rows: 1 },
        v2Withdrawals: { pages: 1, rows: 1 },
        transfersIn: { pages: 1, rows: 1 },
        transfersOut: { pages: 1, rows: 1 }
      },
      totalPages: 6,
      totalRows: 6,
      chainCount: 1,
      validationQueries: 0
    })
    expect(requests).toHaveLength(6)
    expect(
      requests.every(
        ({ query, variables }) =>
          query.includes('blockNumber: { _gte: $lowerBlock, _lte: $upperBlock }') &&
          query.includes('{ blockTimestamp: asc }') &&
          query.includes('{ blockNumber: asc }') &&
          query.includes('{ logIndex: asc }') &&
          query.includes('{ id: asc }') &&
          !query.includes('offset') &&
          !query.includes('_or:') &&
          variables.chainId === 1 &&
          variables.lowerBlock === 100 &&
          variables.upperBlock === 200 &&
          variables.limit === ENVIO_LEDGER_PAGE_SIZE &&
          variables.cursorId === undefined
      )
    ).toBe(true)
    expect(requests.find(({ query }) => query.includes('LedgerV3Deposits'))?.variables.owner).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerV3Withdrawals'))?.variables.owner).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerV2Deposits'))?.variables.recipient).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerV2Withdrawals'))?.variables.recipient).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerTransfersIn'))?.variables.receiver).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerTransfersOut'))?.variables.sender).toBe(CHECKSUM_USER)
  })

  it('keeps self-transfer symmetry checks case-insensitive after checksum query normalization', async () => {
    const requests: TGraphqlRequestBody[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        requests.push(body)
        if (body.query.includes('LedgerTransfers')) {
          return createGraphqlResponse({
            Transfer: [createTransfer('self-transfer', { sender: USER, receiver: USER })]
          })
        }
        const entity = body.query.includes('LedgerV3Deposits')
          ? 'Deposit'
          : body.query.includes('LedgerV3Withdrawals')
            ? 'Withdraw'
            : body.query.includes('LedgerV2Deposits')
              ? 'V2Deposit'
              : 'V2Withdraw'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    const result = await fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])

    expect(result.streams.transfersIn).toHaveLength(1)
    expect(result.streams.transfersOut).toHaveLength(1)
    expect(requests.find(({ query }) => query.includes('LedgerTransfersIn'))?.variables.receiver).toBe(CHECKSUM_USER)
    expect(requests.find(({ query }) => query.includes('LedgerTransfersOut'))?.variables.sender).toBe(CHECKSUM_USER)
  })

  it('rejects a row that does not match the requested stream address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const { query } = parseRequestBody(init)
        if (query.includes('LedgerV3Deposits')) {
          return createGraphqlResponse({ Deposit: [createV3Deposit('wrong-owner', { owner: COUNTERPARTY })] })
        }
        const entity = query.includes('LedgerV3Withdrawals')
          ? 'Withdraw'
          : query.includes('LedgerV2Deposits')
            ? 'V2Deposit'
            : query.includes('LedgerV2Withdrawals')
              ? 'V2Withdraw'
              : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    await expect(fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])).rejects.toThrow(
      'Envio ledger source page did not advance'
    )
  })

  it('rejects a self-transfer returned by only one directional stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const { query } = parseRequestBody(init)
        if (query.includes('LedgerTransfersIn')) {
          return createGraphqlResponse({
            Transfer: [createTransfer('self-transfer', { sender: USER, receiver: USER })]
          })
        }
        const entity = query.includes('LedgerV3Deposits')
          ? 'Deposit'
          : query.includes('LedgerV3Withdrawals')
            ? 'Withdraw'
            : query.includes('LedgerV2Deposits')
              ? 'V2Deposit'
              : query.includes('LedgerV2Withdrawals')
                ? 'V2Withdraw'
                : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    await expect(fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])).rejects.toThrow(
      'Envio ledger source self-transfer streams are inconsistent'
    )
  })

  it('fetches every stream independently for every chain window', async () => {
    const requests: TGraphqlRequestBody[] = []
    const concurrency = { active: 0, maximum: 0 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        concurrency.active += 1
        concurrency.maximum = Math.max(concurrency.maximum, concurrency.active)
        requests.push(body)
        await Promise.resolve()
        concurrency.active -= 1
        const entity = body.query.includes('LedgerV3Deposits')
          ? 'Deposit'
          : body.query.includes('LedgerV3Withdrawals')
            ? 'Withdraw'
            : body.query.includes('LedgerV2Deposits')
              ? 'V2Deposit'
              : body.query.includes('LedgerV2Withdrawals')
                ? 'V2Withdraw'
                : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    const result = await fetchEnvioLedgerStreams(USER, [
      { chainId: 10, lowerBlock: 500, upperBlock: 600 },
      { chainId: 1, lowerBlock: 100, upperBlock: 200 }
    ])

    expect(requests).toHaveLength(12)
    expect(concurrency.maximum).toBe(1)
    expect(requests.map(({ query, variables }) => [query.match(/query (Ledger\w+)/)?.[1], variables.chainId])).toEqual([
      ['LedgerV3DepositsFirstPage', 1],
      ['LedgerV3DepositsFirstPage', 10],
      ['LedgerV3WithdrawalsFirstPage', 1],
      ['LedgerV3WithdrawalsFirstPage', 10],
      ['LedgerV2DepositsFirstPage', 1],
      ['LedgerV2DepositsFirstPage', 10],
      ['LedgerV2WithdrawalsFirstPage', 1],
      ['LedgerV2WithdrawalsFirstPage', 10],
      ['LedgerTransfersInFirstPage', 1],
      ['LedgerTransfersInFirstPage', 10],
      ['LedgerTransfersOutFirstPage', 1],
      ['LedgerTransfersOutFirstPage', 10]
    ])
    expect(requests.filter(({ variables }) => variables.chainId === 1)).toHaveLength(6)
    expect(requests.filter(({ variables }) => variables.chainId === 10)).toHaveLength(6)
    expect(result.stats).toEqual({
      byStream: {
        v3Deposits: { pages: 2, rows: 0 },
        v3Withdrawals: { pages: 2, rows: 0 },
        v2Deposits: { pages: 2, rows: 0 },
        v2Withdrawals: { pages: 2, rows: 0 },
        transfersIn: { pages: 2, rows: 0 },
        transfersOut: { pages: 2, rows: 0 }
      },
      totalPages: 12,
      totalRows: 0,
      chainCount: 2,
      validationQueries: 0
    })
  })

  it('enforces one row budget across every stream and chain window', async () => {
    expect(ENVIO_LEDGER_MAX_FETCHED_ROWS).toBe(250_000)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const { query } = parseRequestBody(init)
        if (query.includes('LedgerV3Deposits')) {
          return createGraphqlResponse({
            Deposit: [createV3Deposit('budget-row-0'), createV3Deposit('budget-row-1')]
          })
        }
        const entity = query.includes('LedgerV3Withdrawals')
          ? 'Withdraw'
          : query.includes('LedgerV2Deposits')
            ? 'V2Deposit'
            : query.includes('LedgerV2Withdrawals')
              ? 'V2Withdraw'
              : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    await expect(
      fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }], {
        budgetLimits: { maximumRows: 1 }
      })
    ).rejects.toThrow('Envio ledger source fetch budget exceeded')
  })

  it('enforces one decoded-byte budget before revision encoding', async () => {
    expect(ENVIO_LEDGER_MAX_FETCHED_DECODED_BYTES).toBe(64 * 1024 * 1024)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const { query } = parseRequestBody(init)
        if (query.includes('LedgerV3Deposits')) {
          return createGraphqlResponse({ Deposit: [createV3Deposit('budget-bytes', { assets: '1'.repeat(512) })] })
        }
        const entity = query.includes('LedgerV3Withdrawals')
          ? 'Withdraw'
          : query.includes('LedgerV2Deposits')
            ? 'V2Deposit'
            : query.includes('LedgerV2Withdrawals')
              ? 'V2Withdraw'
              : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    await expect(
      fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }], {
        budgetLimits: { maximumDecodedBytes: 128 }
      })
    ).rejects.toThrow('Envio ledger source fetch budget exceeded')
  })

  it('iteratively accumulates full pages while advancing a strict keyset cursor', async () => {
    const firstPage = Array.from({ length: ENVIO_LEDGER_PAGE_SIZE }, (_, index) =>
      createTransfer(`transfer-${index.toString().padStart(4, '0')}`)
    )
    const secondPage = Array.from({ length: ENVIO_LEDGER_PAGE_SIZE }, (_, index) =>
      createTransfer(`transfer-${(index + ENVIO_LEDGER_PAGE_SIZE).toString().padStart(4, '0')}`)
    )
    const requests: TGraphqlRequestBody[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        requests.push(body)
        if (!body.query.includes('LedgerTransfersIn')) {
          const entity = body.query.includes('LedgerV3Deposits')
            ? 'Deposit'
            : body.query.includes('LedgerV3Withdrawals')
              ? 'Withdraw'
              : body.query.includes('LedgerV2Deposits')
                ? 'V2Deposit'
                : body.query.includes('LedgerV2Withdrawals')
                  ? 'V2Withdraw'
                  : 'Transfer'
          return createGraphqlResponse({ [entity]: [] })
        }
        const transferPage = !body.query.includes('NextPage')
          ? firstPage
          : body.variables.cursorId === 'transfer-0999'
            ? secondPage
            : [createTransfer('transfer-2000')]
        return createGraphqlResponse({ Transfer: transferPage })
      })
    )

    const result = await fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])
    const transferRequests = requests.filter(({ query }) => query.includes('LedgerTransfersIn'))

    expect(result.streams.transfersIn).toHaveLength(2_001)
    expect(result.streams.transfersIn.at(-1)?.id).toBe('transfer-2000')
    expect(result.stats.byStream.transfersIn).toEqual({ pages: 3, rows: 2_001 })
    expect(result.stats.totalPages).toBe(8)
    expect(transferRequests).toHaveLength(3)
    expect(transferRequests[0]?.query).not.toContain('_or:')
    expect(transferRequests[1]?.query).toContain('_or: [')
    expect(transferRequests[1]?.query).toContain('id: { _gt: $cursorId }')
    expect(transferRequests[1]?.query).not.toContain('offset')
    expect(transferRequests[1]?.variables).toEqual(
      expect.objectContaining({
        cursorTimestamp: 1_000,
        cursorBlock: 150,
        cursorLogIndex: 4,
        cursorId: 'transfer-0999',
        limit: ENVIO_LEDGER_PAGE_SIZE
      })
    )
    expect(transferRequests[2]?.variables.cursorId).toBe('transfer-1999')
  })

  it('rejects a repeated next-page cursor instead of recursing forever', async () => {
    const firstPage = Array.from({ length: ENVIO_LEDGER_PAGE_SIZE }, (_, index) =>
      createTransfer(`transfer-${index.toString().padStart(4, '0')}`)
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        if (body.query.includes('LedgerTransfersIn')) {
          return createGraphqlResponse({
            Transfer: body.query.includes('NextPage') ? [createTransfer('transfer-0999')] : firstPage
          })
        }
        const entity = body.query.includes('LedgerV3Deposits')
          ? 'Deposit'
          : body.query.includes('LedgerV3Withdrawals')
            ? 'Withdraw'
            : body.query.includes('LedgerV2Deposits')
              ? 'V2Deposit'
              : body.query.includes('LedgerV2Withdrawals')
                ? 'V2Withdraw'
                : 'Transfer'
        return createGraphqlResponse({ [entity]: [] })
      })
    )

    await expect(fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])).rejects.toThrow(
      'Envio ledger source page did not advance'
    )
  })

  it('supports the metadata-to-source convenience contract', async () => {
    const onPage = vi.fn(async () => undefined)
    const requests: TGraphqlRequestBody[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = parseRequestBody(init)
        requests.push(body)
        return createGraphqlResponse(getEntityResult(body.query))
      })
    )

    const result = await fetchEnvioLedgerSource({
      address: USER,
      metadata: [createMetadata(1)],
      lowerBlockByChain: { 1: 125 },
      onPage
    })

    expect(result.windows).toEqual([{ chainId: 1, lowerBlock: 125, upperBlock: 1_000 }])
    expect(result.metadata.map(({ chainId }) => chainId)).toEqual([1])
    expect(result.stats.totalRows).toBe(6)
    expect(result.stats.validationQueries).toBe(0)
    expect(onPage).toHaveBeenCalledTimes(6)
    expect(requests.every(({ query }) => !query.includes('_aggregate'))).toBe(true)
  })

  it('cancels a response stream as soon as the hard byte limit is exceeded', async () => {
    const state = { cancelled: false }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(ENVIO_LEDGER_MAX_RESPONSE_BYTES + 1))
      },
      cancel() {
        state.cancelled = true
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } }))
    )

    await expect(fetchEnvioLedgerMetadata()).rejects.toThrow('Envio ledger source response is invalid')
    expect(state.cancelled).toBe(true)
  })

  it('does not expose an address or URL when transport fails', async () => {
    const privateUrl = 'https://private-indexer.invalid/graphql'
    vi.stubEnv('ENVIO_GRAPHQL_URL', privateUrl)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`failed for ${USER} at ${privateUrl}`)
      })
    )

    const request = fetchEnvioLedgerStreams(USER, [{ chainId: 1, lowerBlock: 100, upperBlock: 200 }])
    await expect(request).rejects.toThrow('Envio ledger source request failed')
    await expect(request).rejects.not.toThrow(USER)
    await expect(request).rejects.not.toThrow(privateUrl)
  })
})
