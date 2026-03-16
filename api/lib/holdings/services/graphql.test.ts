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
    const context = await fetchRawUserPnlEvents(USER)

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
})
