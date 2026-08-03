import { getAddress } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

const USER = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
const ROUTER = '0x1111111111111111111111111111111111111111'
const TX_HASH = '0xrouter-stake'
const VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'

function createGraphqlResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function createInMemoryGraphqlResponse(data: Record<string, unknown>): Response {
  return {
    ok: true,
    json: async () => ({ data })
  } as unknown as Response
}

function createTransferEvent(id: string, blockNumber: number) {
  return {
    id,
    vaultAddress: VAULT,
    chainId: 1,
    blockNumber,
    blockTimestamp: 200 + blockNumber,
    logIndex: blockNumber,
    transactionHash: `${TX_HASH}-${id}`,
    transactionFrom: ROUTER,
    sender: ROUTER,
    receiver: USER,
    value: '900'
  }
}

function getEmptyResultKey(query: string): string {
  return query.includes('V2Deposit')
    ? 'V2Deposit'
    : query.includes('V2Withdraw')
      ? 'V2Withdraw'
      : query.includes('Withdraw')
        ? 'Withdraw'
        : query.includes('Transfer')
          ? 'Transfer'
          : 'Deposit'
}

async function importGraphqlModule() {
  vi.resetModules()
  return import('./graphql')
}

describe('fetchUserEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('falls back to one count-free bulk page when aggregate counts are unavailable', async () => {
    const transferEvents = [
      createTransferEvent('aggregate-transfer-in-first', 1),
      createTransferEvent('aggregate-transfer-in-last', 2)
    ]

    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
        variables: Record<string, unknown>
      }
      const query = body.query
      const variables = body.variables

      if (query.includes('GetUserEventCountsAggregate')) {
        return new Response(
          JSON.stringify({
            errors: [{ message: "field 'Deposit_aggregate' not found in type: 'query_root'" }]
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (query.includes('GetTransfersIn')) {
        expect(variables.limit).toBe(50000)
        expect(variables.offset).toBe(0)

        return createGraphqlResponse({
          Transfer: transferEvents
        })
      }

      if (
        query.includes('GetDeposits(') ||
        query.includes('GetWithdrawals(') ||
        query.includes('GetTransfersOut') ||
        query.includes('GetV2Deposits(') ||
        query.includes('GetV2Withdrawals(')
      ) {
        return createGraphqlResponse({ [getEmptyResultKey(query)]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchUserEvents } = await importGraphqlModule()
    const events = await fetchUserEvents(USER, 'all', undefined, 'parallel')

    expect(events.transfersIn).toHaveLength(2)
    expect(events.transfersIn[0]).toEqual(
      expect.objectContaining({
        id: 'aggregate-transfer-in-first'
      })
    )
    expect(events.transfersIn[1]).toEqual(
      expect.objectContaining({
        id: 'aggregate-transfer-in-last'
      })
    )
    expect(fetchStub).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('GetUserEventCountsAggregate')
      })
    )
    expect(
      fetchStub.mock.calls.filter(([, init]) =>
        String((init as RequestInit | undefined)?.body ?? '').includes('GetTransfersIn')
      )
    ).toHaveLength(1)
  })

  it('continues count-free bulk pagination when a page reaches the single-query limit', async () => {
    const firstTransfer = createTransferEvent('bulk-transfer-in-first', 1)
    const finalTransfer = createTransferEvent('bulk-transfer-in-final', 2)
    const fullPage = Array.from({ length: 50000 }, () => firstTransfer)

    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
        variables: Record<string, unknown>
      }
      const query = body.query
      const variables = body.variables

      if (query.includes('GetUserEventCountsAggregate')) {
        return new Response(
          JSON.stringify({
            errors: [{ message: "field 'Deposit_aggregate' not found in type: 'query_root'" }]
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (query.includes('GetTransfersIn')) {
        const offset = Number(variables.offset ?? 0)

        return createInMemoryGraphqlResponse({
          Transfer: offset === 0 ? fullPage : offset === 50000 ? [finalTransfer] : []
        })
      }

      if (
        query.includes('GetDeposits(') ||
        query.includes('GetWithdrawals(') ||
        query.includes('GetTransfersOut') ||
        query.includes('GetV2Deposits(') ||
        query.includes('GetV2Withdrawals(')
      ) {
        return createGraphqlResponse({ [getEmptyResultKey(query)]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchUserEvents } = await importGraphqlModule()
    const events = await fetchUserEvents(USER, 'all', undefined, 'parallel')
    const transferRequests = fetchStub.mock.calls
      .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')))
      .filter(({ query }) => String(query).includes('GetTransfersIn'))

    expect(events.transfersIn).toHaveLength(50001)
    expect(events.transfersIn[50000]).toEqual(expect.objectContaining({ id: 'bulk-transfer-in-final' }))
    expect(transferRequests).toEqual([
      expect.objectContaining({ variables: expect.objectContaining({ limit: 50000, offset: 0 }) }),
      expect.objectContaining({ variables: expect.objectContaining({ limit: 50000, offset: 50000 }) })
    ])
  })

  it('supports fetching address events in a single query without aggregate preflight', async () => {
    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
        variables: Record<string, unknown>
      }
      const query = body.query
      const variables = body.variables

      if (query.includes('GetUserEventCountsAggregate')) {
        throw new Error('Aggregate preflight should be skipped in paginationMode=all')
      }

      if (query.includes('GetTransfersIn')) {
        expect(query).toContain('receiver: { _eq: $receiver }')
        expect(variables.receiver).toBe(getAddress(USER))
        expect(variables.limit).toBe(50000)
        expect(variables.offset).toBe(0)

        return createGraphqlResponse({
          Transfer: [
            {
              id: 'single-query-transfer-in',
              vaultAddress: VAULT,
              chainId: 1,
              blockNumber: 2,
              blockTimestamp: 200,
              logIndex: 2,
              transactionHash: TX_HASH,
              transactionFrom: ROUTER,
              sender: ROUTER,
              receiver: USER,
              value: '900'
            }
          ]
        })
      }

      if (
        query.includes('GetDeposits(') ||
        query.includes('GetWithdrawals(') ||
        query.includes('GetTransfersOut') ||
        query.includes('GetV2Deposits(') ||
        query.includes('GetV2Withdrawals(')
      ) {
        return createGraphqlResponse({ [getEmptyResultKey(query)]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchUserEvents } = await importGraphqlModule()
    const events = await fetchUserEvents(USER, 'all', undefined, 'parallel', 'all')

    expect(events.transfersIn).toEqual([
      expect.objectContaining({
        id: 'single-query-transfer-in'
      })
    ])
    expect(
      fetchStub.mock.calls.some(([, init]) =>
        String((init as RequestInit | undefined)?.body ?? '').includes('GetUserEventCountsAggregate')
      )
    ).toBe(false)
  })

  it('reuses in-flight address-scoped fetches for matching requests', async () => {
    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
      }
      const query = body.query

      if (query.includes('GetTransfersIn')) {
        return createGraphqlResponse({
          Transfer: [
            {
              id: 'shared-transfer-in',
              vaultAddress: VAULT,
              chainId: 1,
              blockNumber: 2,
              blockTimestamp: 200,
              logIndex: 2,
              transactionHash: TX_HASH,
              transactionFrom: ROUTER,
              sender: ROUTER,
              receiver: USER,
              value: '900'
            }
          ]
        })
      }

      if (
        query.includes('GetDeposits(') ||
        query.includes('GetWithdrawals(') ||
        query.includes('GetTransfersOut') ||
        query.includes('GetV2Deposits(') ||
        query.includes('GetV2Withdrawals(')
      ) {
        return createGraphqlResponse({ [getEmptyResultKey(query)]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchUserEvents } = await importGraphqlModule()
    const [leftEvents, rightEvents] = await Promise.all([
      fetchUserEvents(USER, 'all', 123456),
      fetchUserEvents(USER, 'all', 123456)
    ])

    expect(leftEvents.transfersIn).toEqual([
      expect.objectContaining({
        id: 'shared-transfer-in'
      })
    ])
    expect(rightEvents.transfersIn).toEqual([
      expect.objectContaining({
        id: 'shared-transfer-in'
      })
    ])
    expect(
      fetchStub.mock.calls.filter(([, init]) =>
        String((init as RequestInit | undefined)?.body ?? '').includes('GetTransfersIn')
      )
    ).toHaveLength(1)
    expect(
      fetchStub.mock.calls.filter(([, init]) =>
        String((init as RequestInit | undefined)?.body ?? '').includes('GetDeposits(')
      )
    ).toHaveLength(1)
  })
})

describe('fetchAddressActivityChainIdsByExistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns supported chain ids with at least one address-scoped event', async () => {
    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
        variables: Record<string, unknown>
      }

      expect(body.query).toContain('GetAddressActivityChainPresence')
      expect(body.query).toContain('limit: 1')
      expect(body.variables.address).toBe(getAddress(USER))

      const chainId = Number(body.variables.chainId)

      return createGraphqlResponse({
        deposits: chainId === 1 ? [{ id: 'ethereum-deposit' }] : [],
        withdrawals: [],
        transfersIn: chainId === 8453 ? [{ id: 'base-transfer-in' }] : [],
        transfersOut: [],
        v2Deposits: [],
        v2Withdrawals: []
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchAddressActivityChainIdsByExistence } = await importGraphqlModule()
    const chainIds = await fetchAddressActivityChainIdsByExistence(USER, 'all')

    expect(chainIds).toEqual([1, 8453])
    expect(fetchStub).toHaveBeenCalledTimes(7)
  })

  it('respects the requested vault version when checking chain presence', async () => {
    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        variables: Record<string, unknown>
      }
      const chainId = Number(body.variables.chainId)

      return createGraphqlResponse({
        deposits: chainId === 1 ? [{ id: 'ethereum-v3-deposit' }] : [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: [],
        v2Deposits: chainId === 137 ? [{ id: 'polygon-v2-deposit' }] : [],
        v2Withdrawals: []
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchAddressActivityChainIdsByExistence } = await importGraphqlModule()

    await expect(fetchAddressActivityChainIdsByExistence(USER, 'v3')).resolves.toEqual([1])
    await expect(fetchAddressActivityChainIdsByExistence(USER, 'v2')).resolves.toEqual([137])
  })
})
