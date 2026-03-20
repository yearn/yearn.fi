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

async function importGraphqlModule() {
  vi.resetModules()
  return import('./graphql')
}

describe('fetchRawUserPnlEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('enriches transaction events from address event tx hashes when tx-from queries are empty', async () => {
    const txHashQueries: Array<{ queryName: string; chainId: number; transactionHashes: string[] }> = []
    const fetchStub = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        query: string
        variables: Record<string, unknown>
      }
      const query = body.query
      const variables = body.variables

      if (query.includes('GetUserEventCountsAggregate')) {
        return createGraphqlResponse({
          deposits: { aggregate: { count: 0 } },
          withdrawals: { aggregate: { count: 0 } },
          transfersIn: { aggregate: { count: 1 } },
          transfersOut: { aggregate: { count: 0 } },
          v2Deposits: { aggregate: { count: 0 } },
          v2Withdrawals: { aggregate: { count: 0 } }
        })
      }

      if (query.includes('GetDepositsByTransactionHashes')) {
        txHashQueries.push({
          queryName: 'Deposit',
          chainId: Number(variables.chainId),
          transactionHashes: [...((variables.transactionHashes as string[]) ?? [])]
        })

        return createGraphqlResponse({
          Deposit: [
            {
              id: 'tx-hash-deposit',
              vaultAddress: VAULT,
              chainId: 1,
              blockNumber: 2,
              blockTimestamp: 200,
              logIndex: 1,
              transactionHash: TX_HASH,
              transactionFrom: ROUTER,
              owner: ROUTER,
              sender: ROUTER,
              assets: '1000',
              shares: '900'
            }
          ]
        })
      }

      if (query.includes('GetWithdrawalsByTransactionHashes')) {
        txHashQueries.push({
          queryName: 'Withdraw',
          chainId: Number(variables.chainId),
          transactionHashes: [...((variables.transactionHashes as string[]) ?? [])]
        })

        return createGraphqlResponse({ Withdraw: [] })
      }

      if (query.includes('GetTransfersByTransactionHashes')) {
        txHashQueries.push({
          queryName: 'Transfer',
          chainId: Number(variables.chainId),
          transactionHashes: [...((variables.transactionHashes as string[]) ?? [])]
        })

        return createGraphqlResponse({ Transfer: [] })
      }

      if (query.includes('GetV2DepositsByTransactionHashes')) {
        return createGraphqlResponse({ V2Deposit: [] })
      }

      if (query.includes('GetV2WithdrawalsByTransactionHashes')) {
        return createGraphqlResponse({ V2Withdraw: [] })
      }

      if (query.includes('GetTransfersIn')) {
        return createGraphqlResponse({
          Transfer: [
            {
              id: 'address-transfer-in',
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
        query.includes('GetV2Withdrawals(') ||
        query.includes('GetDepositsByTransactionFrom') ||
        query.includes('GetWithdrawalsByTransactionFrom') ||
        query.includes('GetV2DepositsByTransactionFrom') ||
        query.includes('GetV2WithdrawalsByTransactionFrom') ||
        query.includes('GetTransfersByTransactionFrom')
      ) {
        const resultKey = query.includes('V2Deposit')
          ? 'V2Deposit'
          : query.includes('V2Withdraw')
            ? 'V2Withdraw'
            : query.includes('Withdraw')
              ? 'Withdraw'
              : query.includes('Transfer')
                ? 'Transfer'
                : 'Deposit'

        return createGraphqlResponse({ [resultKey]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchRawUserPnlEvents } = await importGraphqlModule()
    const context = await fetchRawUserPnlEvents(USER, 'all', undefined, 'parallel')

    expect(context.addressEvents.transfersIn).toHaveLength(1)
    expect(context.transactionEvents.deposits).toEqual([
      expect.objectContaining({
        id: 'tx-hash-deposit',
        transactionHash: TX_HASH,
        owner: ROUTER,
        assets: '1000',
        shares: '900'
      })
    ])
    expect(context.transactionEvents.withdrawals).toEqual([])
    expect(txHashQueries).toEqual([
      { queryName: 'Deposit', chainId: 1, transactionHashes: [TX_HASH] },
      { queryName: 'Withdraw', chainId: 1, transactionHashes: [TX_HASH] },
      { queryName: 'Transfer', chainId: 1, transactionHashes: [TX_HASH] }
    ])
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
        query.includes('GetV2Withdrawals(') ||
        query.includes('GetDepositsByTransactionFrom') ||
        query.includes('GetWithdrawalsByTransactionFrom') ||
        query.includes('GetV2DepositsByTransactionFrom') ||
        query.includes('GetV2WithdrawalsByTransactionFrom') ||
        query.includes('GetTransfersByTransactionFrom') ||
        query.includes('GetDepositsByTransactionHashes') ||
        query.includes('GetWithdrawalsByTransactionHashes') ||
        query.includes('GetTransfersByTransactionHashes') ||
        query.includes('GetV2DepositsByTransactionHashes') ||
        query.includes('GetV2WithdrawalsByTransactionHashes')
      ) {
        const resultKey = query.includes('V2Deposit')
          ? 'V2Deposit'
          : query.includes('V2Withdraw')
            ? 'V2Withdraw'
            : query.includes('Withdraw')
              ? 'Withdraw'
              : query.includes('Transfer')
                ? 'Transfer'
                : 'Deposit'

        return createGraphqlResponse({ [resultKey]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchRawUserPnlEvents } = await importGraphqlModule()
    const context = await fetchRawUserPnlEvents(USER, 'all', undefined, 'parallel')

    expect(context.addressEvents.transfersIn).toHaveLength(1001)
    expect(context.addressEvents.transfersIn[0]).toEqual(
      expect.objectContaining({
        id: 'aggregate-transfer-in-0'
      })
    )
    expect(context.addressEvents.transfersIn[1000]).toEqual(
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
        query.includes('GetV2Withdrawals(') ||
        query.includes('GetDepositsByTransactionFrom') ||
        query.includes('GetWithdrawalsByTransactionFrom') ||
        query.includes('GetV2DepositsByTransactionFrom') ||
        query.includes('GetV2WithdrawalsByTransactionFrom') ||
        query.includes('GetTransfersByTransactionFrom') ||
        query.includes('GetDepositsByTransactionHashes') ||
        query.includes('GetWithdrawalsByTransactionHashes') ||
        query.includes('GetTransfersByTransactionHashes') ||
        query.includes('GetV2DepositsByTransactionHashes') ||
        query.includes('GetV2WithdrawalsByTransactionHashes')
      ) {
        const resultKey = query.includes('V2Deposit')
          ? 'V2Deposit'
          : query.includes('V2Withdraw')
            ? 'V2Withdraw'
            : query.includes('Withdraw')
              ? 'Withdraw'
              : query.includes('Transfer')
                ? 'Transfer'
                : 'Deposit'

        return createGraphqlResponse({ [resultKey]: [] })
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    vi.stubGlobal('fetch', fetchStub)

    const { fetchRawUserPnlEvents } = await importGraphqlModule()
    const context = await fetchRawUserPnlEvents(USER, 'all', undefined, 'parallel', 'all')

    expect(context.addressEvents.transfersIn).toEqual([
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
})
