import { encodeAbiParameters, encodeEventTopics, encodeFunctionResult, erc20Abi, parseAbiItem } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRecentAddressScopedActivityEventsMock = vi.fn()
const fetchActivityEventsByTransactionHashesMock = vi.fn()
const fetchMultipleVaultsMetadataMock = vi.fn()

vi.mock('./graphql', () => ({
  fetchRecentAddressScopedActivityEvents: fetchRecentAddressScopedActivityEventsMock,
  fetchActivityEventsByTransactionHashes: fetchActivityEventsByTransactionHashesMock
}))

vi.mock('./vaults', () => ({
  fetchMultipleVaultsMetadata: fetchMultipleVaultsMetadataMock
}))

const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'
const HIDDEN_VAULT = '0x0000000000000000000000000000000000000123'
const UNKNOWN_VAULT = '0x0000000000000000000000000000000000000456'
const USER_ADDRESS = '0x2222222222222222222222222222222222222222'
const INTERMEDIARY = '0x4Fe93ebC4Ce6Ae4f81601cC7Ce7139023919E003'
const USDT0 = '0x5555555555555555555555555555555555555555'
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

function createDepositEvent(args: {
  id: string
  vaultAddress: string
  transactionHash: string
  blockTimestamp: number
  logIndex: number
  assets: string
  shares?: string
  sender?: string
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: 1,
    blockNumber: args.blockTimestamp,
    blockTimestamp: args.blockTimestamp,
    logIndex: args.logIndex,
    transactionHash: args.transactionHash,
    transactionFrom: USER_ADDRESS,
    owner: USER_ADDRESS,
    sender: args.sender ?? USER_ADDRESS,
    assets: args.assets,
    shares: args.shares ?? args.assets
  }
}

function createWithdrawalEvent(args: {
  id: string
  vaultAddress: string
  transactionHash: string
  blockTimestamp: number
  logIndex: number
  assets: string
  shares?: string
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: 1,
    blockNumber: args.blockTimestamp,
    blockTimestamp: args.blockTimestamp,
    logIndex: args.logIndex,
    transactionHash: args.transactionHash,
    transactionFrom: USER_ADDRESS,
    owner: USER_ADDRESS,
    assets: args.assets,
    shares: args.shares ?? args.assets
  }
}

function createTransferEvent(args: {
  id: string
  vaultAddress: string
  transactionHash: string
  blockTimestamp: number
  logIndex: number
  value: string
  sender: string
  receiver: string
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: 1,
    blockNumber: args.blockTimestamp,
    blockTimestamp: args.blockTimestamp,
    logIndex: args.logIndex,
    transactionHash: args.transactionHash,
    transactionFrom: USER_ADDRESS,
    sender: args.sender,
    receiver: args.receiver,
    value: args.value
  }
}

function createTransferLog(args: { tokenAddress: string; from: string; to: string; value: bigint }) {
  return {
    address: args.tokenAddress,
    data: encodeAbiParameters([{ type: 'uint256' }], [args.value]),
    topics: encodeEventTopics({
      abi: [TRANSFER_EVENT],
      eventName: 'Transfer',
      args: {
        from: args.from,
        to: args.to
      }
    }),
    logIndex: '0x1'
  }
}

function mockReceiptEnrichmentRpc(args: { tokenAddress: string; tokenSymbol: string; tokenDecimals: number }) {
  process.env.VITE_RPC_URI_FOR_1 = 'https://rpc.example'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Array<{ data?: string }>
      }

      if (body.method === 'eth_getTransactionReceipt') {
        return new Response(
          JSON.stringify({
            result: {
              logs: [
                createTransferLog({
                  tokenAddress: args.tokenAddress,
                  from: USER_ADDRESS,
                  to: INTERMEDIARY,
                  value: 230000n
                })
              ]
            }
          })
        )
      }

      if (body.method === 'eth_call') {
        const data = body.params?.[0]?.data

        return new Response(
          JSON.stringify({
            result:
              data === '0x95d89b41'
                ? encodeFunctionResult({
                    abi: erc20Abi,
                    functionName: 'symbol',
                    result: args.tokenSymbol
                  })
                : encodeFunctionResult({
                    abi: erc20Abi,
                    functionName: 'decimals',
                    result: args.tokenDecimals
                  })
          })
        )
      }

      return new Response(JSON.stringify({ result: null }))
    })
  )
}

describe('getHoldingsActivity', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfers: []
    })
  })

  it('aggregates recent events, classifies staking actions, and filters hidden vaults', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 200,
          logIndex: 3,
          assets: '1500000',
          shares: '1500000000000000000'
        }),
        createDepositEvent({
          id: 'deposit-2',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 200,
          logIndex: 2,
          assets: '500000',
          shares: '500000000000000000'
        }),
        createDepositEvent({
          id: 'stake-1',
          vaultAddress: STAKING_VAULT,
          transactionHash: '0xbbb',
          blockTimestamp: 190,
          logIndex: 1,
          assets: '2000000000000000000'
        }),
        createDepositEvent({
          id: 'hidden-1',
          vaultAddress: HIDDEN_VAULT,
          transactionHash: '0xddd',
          blockTimestamp: 170,
          logIndex: 1,
          assets: '1000000'
        })
      ],
      withdrawals: [
        createWithdrawalEvent({
          id: 'unstake-1',
          vaultAddress: STAKING_VAULT,
          transactionHash: '0xccc',
          blockTimestamp: 180,
          logIndex: 1,
          assets: '1000000000000000000'
        })
      ],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })

    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 1,
            version: 'v3',
            category: 'stable',
            token: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              decimals: 6
            },
            decimals: 18
          }
        ],
        [
          `1:${STAKING_VAULT}`,
          {
            address: STAKING_VAULT,
            chainId: 1,
            version: 'v3',
            category: 'stable',
            token: {
              address: UNDERLYING_VAULT,
              symbol: 'yvUSDC',
              decimals: 18
            },
            decimals: 18
          }
        ],
        [
          `1:${HIDDEN_VAULT}`,
          {
            address: HIDDEN_VAULT,
            chainId: 1,
            version: 'v3',
            isHidden: true,
            category: 'stable',
            token: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              decimals: 6
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 4)

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 20)
    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xaaa',
        timestamp: 200,
        action: 'deposit',
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '2000000000000000000',
        shareAmountFormatted: 2,
        status: 'ok'
      },
      {
        chainId: 1,
        txHash: '0xbbb',
        timestamp: 190,
        action: 'stake',
        vaultAddress: STAKING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'yvUSDC',
        assetAmount: '2000000000000000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '2000000000000000000',
        shareAmountFormatted: 2,
        status: 'ok'
      },
      {
        chainId: 1,
        txHash: '0xccc',
        timestamp: 180,
        action: 'unstake',
        vaultAddress: STAKING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'yvUSDC',
        assetAmount: '1000000000000000000',
        assetAmountFormatted: 1,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '1000000000000000000',
        shareAmountFormatted: 1,
        status: 'ok'
      }
    ])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('enriches router-mediated deposits with the user input token from the tx receipt', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'enso-deposit',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xenso',
          blockTimestamp: 230,
          logIndex: 2,
          assets: '230118',
          shares: '202094',
          sender: INTERMEDIARY
        })
      ],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 1,
            version: 'v3',
            category: 'stable',
            token: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              decimals: 6
            },
            decimals: 6
          }
        ]
      ])
    )
    mockReceiptEnrichmentRpc({
      tokenAddress: USDT0,
      tokenSymbol: 'USDT0',
      tokenDecimals: 6
    })

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xenso',
        timestamp: 230,
        action: 'deposit',
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '230118',
        assetAmountFormatted: 0.230118,
        inputTokenAddress: USDT0.toLowerCase(),
        inputTokenSymbol: 'USDT0',
        inputTokenAmount: '230000',
        inputTokenAmountFormatted: 0.23,
        shareAmount: '202094',
        shareAmountFormatted: 0.202094,
        status: 'ok'
      }
    ])
  })

  it('keeps entries with missing metadata and null formatted amount', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [
        createWithdrawalEvent({
          id: 'unknown-1',
          vaultAddress: UNKNOWN_VAULT,
          transactionHash: '0xeee',
          blockTimestamp: 220,
          logIndex: 1,
          assets: '123456789'
        })
      ],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xeee',
        timestamp: 220,
        action: 'withdraw',
        vaultAddress: UNKNOWN_VAULT,
        familyVaultAddress: UNKNOWN_VAULT,
        assetSymbol: null,
        assetAmount: '123456789',
        assetAmountFormatted: null,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '123456789',
        shareAmountFormatted: null,
        status: 'missing_metadata'
      }
    ])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('returns later pages and exposes next offset when more transactions exist', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-page-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 300,
          logIndex: 2,
          assets: '1000000',
          shares: '1000000000000000000'
        }),
        createDepositEvent({
          id: 'deposit-page-2',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xbbb',
          blockTimestamp: 290,
          logIndex: 2,
          assets: '2000000',
          shares: '2000000000000000000'
        }),
        createDepositEvent({
          id: 'deposit-page-3',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xccc',
          blockTimestamp: 280,
          logIndex: 2,
          assets: '3000000',
          shares: '3000000000000000000'
        })
      ],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: true,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })

    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 1,
            version: 'v3',
            category: 'stable',
            token: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              decimals: 6
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 1)

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 20)
    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xbbb',
        timestamp: 290,
        action: 'deposit',
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '2000000000000000000',
        shareAmountFormatted: 2,
        status: 'ok'
      }
    ])
    expect(response.pageInfo).toEqual({
      hasMore: true,
      nextOffset: 2
    })
  })

  it('recovers routed withdrawals from address transfers plus tx-scoped withdraw events', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [
        createTransferEvent({
          id: 'transfer-out-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xroute',
          blockTimestamp: 400,
          logIndex: 1,
          value: '849068037733633594470',
          sender: USER_ADDRESS,
          receiver: INTERMEDIARY
        })
      ],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [
        createWithdrawalEvent({
          id: 'withdraw-route-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xroute',
          blockTimestamp: 400,
          logIndex: 5,
          assets: '1072609',
          shares: '849068037733633594470'
        })
      ],
      transfers: [
        createTransferEvent({
          id: 'transfer-burn-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xroute',
          blockTimestamp: 400,
          logIndex: 4,
          value: '849068037733633594470',
          sender: INTERMEDIARY,
          receiver: '0x0000000000000000000000000000000000000000'
        })
      ]
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 1,
            version: 'v3',
            category: 'stable',
            token: {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              decimals: 6
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(fetchActivityEventsByTransactionHashesMock).toHaveBeenCalledWith(new Map([[1, ['0xroute']]]), 'all')
    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xroute',
        timestamp: 400,
        action: 'withdraw',
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '1072609',
        assetAmountFormatted: 1.072609,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        shareAmount: '849068037733633594470',
        shareAmountFormatted: 849.0680377336336,
        status: 'ok'
      }
    ])
  })
})
