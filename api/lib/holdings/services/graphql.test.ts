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

  it('falls back to sequential pagination when aggregate counts are unavailable', async () => {
    const transferBatches = [
      Array.from({ length: 1000 }, (_, index) => ({
        id: `aggregate-transfer-in-${index}`,
        vaultAddress: VAULT,
        chainId: 1,
        blockNumber: index + 1,
        blockTimestamp: 200 + index,
        logIndex: index,
        transactionHash: `${TX_HASH}-${index}`,
        transactionFrom: ROUTER,
        sender: ROUTER,
        receiver: USER,
        value: '900'
      })),
      [
        {
          id: 'aggregate-transfer-in-last',
          vaultAddress: VAULT,
          chainId: 1,
          blockNumber: 1001,
          blockTimestamp: 1201,
          logIndex: 1000,
          transactionHash: `${TX_HASH}-last`,
          transactionFrom: ROUTER,
          sender: ROUTER,
          receiver: USER,
          value: '900'
        }
      ]
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
        const offset = Number(variables.offset ?? 0)
        const batch = offset === 0 ? transferBatches[0] : offset === 1000 ? transferBatches[1] : []

        return createGraphqlResponse({
          Transfer: batch
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

    expect(events.transfersIn).toHaveLength(1001)
    expect(events.transfersIn[0]).toEqual(
      expect.objectContaining({
        id: 'aggregate-transfer-in-0'
      })
    )
    expect(events.transfersIn[1000]).toEqual(
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
    ).toHaveLength(2)
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
