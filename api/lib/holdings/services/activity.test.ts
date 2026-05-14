import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  parseAbiItem
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRecentAddressScopedActivityEventsMock = vi.fn()
const fetchActivityEventsByTransactionHashesMock = vi.fn()
const fetchUserEventsMock = vi.fn()
const fetchMultipleVaultsMetadataMock = vi.fn()

vi.mock('./graphql', () => ({
  fetchRecentAddressScopedActivityEvents: fetchRecentAddressScopedActivityEventsMock,
  fetchActivityEventsByTransactionHashes: fetchActivityEventsByTransactionHashesMock,
  fetchUserEvents: fetchUserEventsMock
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
const YCRV_ZAP = '0x78ada385b15d89a9b845d2cac0698663f0c69e3c'
const YBS_REWARD_DISTRIBUTOR = '0xB226c52EB411326CdB54824a88aBaFDAAfF16D3d'
const YYB_REWARD_DISTRIBUTOR = '0x1d02F6A86Ed5650f93E40FCD62fa5727c32ad746'
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const YCRV_ZAP_TEST_ABI = [
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'zap',
    inputs: [
      { name: '_input_token', type: 'address' },
      { name: '_output_token', type: 'address' },
      { name: '_amount_in', type: 'uint256' },
      { name: '_min_out', type: 'uint256' },
      { name: '_recipient', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const
const V2_VAULT_TEST_ABI = [
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'deposit',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: '_maxShares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const

function createDepositEvent(args: {
  id: string
  vaultAddress: string
  transactionHash: string
  blockTimestamp: number
  logIndex: number
  assets: string
  shares?: string
  sender?: string
  chainId?: number
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: args.chainId ?? 1,
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
  chainId?: number
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: args.chainId ?? 1,
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
  chainId?: number
}) {
  return {
    id: args.id,
    vaultAddress: args.vaultAddress,
    chainId: args.chainId ?? 1,
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

function mockYcrvZapRpc(args: {
  inputTokenAddress: string
  outputTokenAddress: string
  inputAmount: bigint
  inputTokenSymbol: string
  inputTokenDecimals: number
}) {
  process.env.VITE_RPC_URI_FOR_1 = 'https://rpc.example'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Array<{ data?: string }>
      }

      if (body.method === 'eth_getTransactionByHash') {
        return new Response(
          JSON.stringify({
            result: {
              to: YCRV_ZAP,
              input: encodeFunctionData({
                abi: YCRV_ZAP_TEST_ABI,
                functionName: 'zap',
                args: [args.inputTokenAddress, args.outputTokenAddress, args.inputAmount, 1n, USER_ADDRESS]
              })
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
                    result: args.inputTokenSymbol
                  })
                : encodeFunctionResult({
                    abi: erc20Abi,
                    functionName: 'decimals',
                    result: args.inputTokenDecimals
                  })
          })
        )
      }

      return new Response(JSON.stringify({ result: null }))
    })
  )
}

function mockRewardDistributorRpc(transactionTargets: Record<string, string>) {
  process.env.VITE_RPC_URI_FOR_1 = 'https://rpc.example'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: string[]
      }
      const transactionHash = body.params?.[0]

      return new Response(
        JSON.stringify({
          result:
            body.method === 'eth_getTransactionByHash' && transactionHash
              ? {
                  to: transactionTargets[transactionHash] ?? INTERMEDIARY,
                  input: '0x'
                }
              : null
        })
      )
    })
  )
}

function mockDirectV2VaultRpc(args: {
  transactionHash: string
  vaultAddress: string
  action: 'deposit' | 'withdraw'
  assetAmount: bigint
  underlyingTokenAddress?: string
}) {
  process.env.VITE_RPC_URI_FOR_1 = 'https://rpc.example'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: string[]
      }

      if (body.method === 'eth_getTransactionByHash' && body.params?.[0] === args.transactionHash) {
        return new Response(
          JSON.stringify({
            result: {
              to: args.vaultAddress,
              input: encodeFunctionData({
                abi: V2_VAULT_TEST_ABI,
                functionName: args.action,
                args: [args.assetAmount]
              })
            }
          })
        )
      }

      if (body.method === 'eth_getTransactionReceipt' && args.action === 'withdraw') {
        return new Response(
          JSON.stringify({
            result: {
              logs: [
                createTransferLog({
                  tokenAddress: args.underlyingTokenAddress ?? USDT0,
                  from: args.vaultAddress,
                  to: USER_ADDRESS,
                  value: args.assetAmount
                })
              ]
            }
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
    delete process.env.VITE_RPC_URI_FOR_1
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfers: []
    })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
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
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '2000000000000000000',
        shareAmountFormatted: 2,
        status: 'ok'
      },
      {
        chainId: 1,
        txHash: '0xbbb',
        timestamp: 190,
        action: 'stake',
        transferDirection: null,
        vaultAddress: STAKING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'yvUSDC',
        assetAmount: '2000000000000000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '2000000000000000000',
        shareAmountFormatted: 2,
        status: 'ok'
      },
      {
        chainId: 1,
        txHash: '0xccc',
        timestamp: 180,
        action: 'unstake',
        transferDirection: null,
        vaultAddress: STAKING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'yvUSDC',
        assetAmount: '1000000000000000000',
        assetAmountFormatted: 1,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
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
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '230118',
        assetAmountFormatted: 0.230118,
        inputTokenAddress: USDT0.toLowerCase(),
        inputTokenSymbol: 'USDT0',
        inputTokenAmount: '230000',
        inputTokenAmountFormatted: 0.23,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
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
        transferDirection: null,
        vaultAddress: UNKNOWN_VAULT,
        familyVaultAddress: UNKNOWN_VAULT,
        assetSymbol: null,
        assetAmount: '123456789',
        assetAmountFormatted: null,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
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
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
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

  it('filters activity by action before paginating', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-filter-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 300,
          logIndex: 2,
          assets: '1000000'
        }),
        createDepositEvent({
          id: 'deposit-filter-2',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xbbb',
          blockTimestamp: 290,
          logIndex: 2,
          assets: '2000000'
        })
      ],
      withdrawals: [
        createWithdrawalEvent({
          id: 'withdraw-filter-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xccc',
          blockTimestamp: 280,
          logIndex: 2,
          assets: '3000000'
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
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, { type: 'withdraw' })

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 80)
    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xccc',
        timestamp: 280,
        action: 'withdraw',
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '3000000',
        assetAmountFormatted: 3,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '3000000',
        shareAmountFormatted: 0.000000000003,
        status: 'ok'
      }
    ])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('filters activity by chain before paginating', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-chain-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 300,
          logIndex: 2,
          assets: '1000000'
        }),
        {
          ...createDepositEvent({
            id: 'deposit-chain-2',
            vaultAddress: UNDERLYING_VAULT,
            transactionHash: '0xbbb',
            blockTimestamp: 290,
            logIndex: 2,
            assets: '2000000'
          }),
          chainId: 137
        }
      ],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })

    fetchUserEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-chain-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 300,
          logIndex: 2,
          assets: '1000000'
        }),
        {
          ...createDepositEvent({
            id: 'deposit-chain-2',
            vaultAddress: UNDERLYING_VAULT,
            transactionHash: '0xbbb',
            blockTimestamp: 290,
            logIndex: 2,
            assets: '2000000'
          }),
          chainId: 137
        }
      ],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })

    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `137:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 137,
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
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, { chainId: 137 })

    expect(response.entries).toEqual([
      {
        chainId: 137,
        txHash: '0xbbb',
        timestamp: 290,
        action: 'deposit',
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '2000000',
        shareAmountFormatted: 0.000000000002,
        status: 'ok'
      }
    ])
  })

  it('uses the bounded filtered scanner for chain-filtered activity', async () => {
    const baseVault = '0xc3bd0a2193c8f027b82dde3611d18589ef3f62a9'
    const baseDeposit = {
      ...createDepositEvent({
        id: 'deposit-base-older',
        vaultAddress: baseVault,
        transactionHash: '0xeae5d579a571e592719d0815674744238a49993e7a7322c29d81b88343ef1c7b',
        blockTimestamp: 100,
        logIndex: 1,
        assets: '3000000'
      }),
      chainId: 8453
    }

    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-mainnet-newer',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 500,
          logIndex: 1,
          assets: '1000000'
        }),
        baseDeposit
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
          `8453:${baseVault}`,
          {
            address: baseVault,
            chainId: 8453,
            version: 'v3',
            category: 'stable',
            token: {
              address: '0x4200000000000000000000000000000000000006',
              symbol: 'WETH',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, { chainId: 8453 })

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 80)
    expect(fetchUserEventsMock).not.toHaveBeenCalled()
    expect(fetchActivityEventsByTransactionHashesMock).toHaveBeenCalledWith(
      new Map([[8453, ['0xeae5d579a571e592719d0815674744238a49993e7a7322c29d81b88343ef1c7b']]]),
      'all'
    )
    expect(response.entries).toEqual([
      {
        chainId: 8453,
        txHash: '0xeae5d579a571e592719d0815674744238a49993e7a7322c29d81b88343ef1c7b',
        timestamp: 100,
        action: 'deposit',
        transferDirection: null,
        vaultAddress: baseVault,
        familyVaultAddress: baseVault,
        assetSymbol: 'WETH',
        assetAmount: '3000000',
        assetAmountFormatted: 0.000000000003,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '3000000',
        shareAmountFormatted: 0.000000000003,
        status: 'ok'
      }
    ])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('filters activity by timestamp range before paginating', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-range-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xaaa',
          blockTimestamp: 300,
          logIndex: 2,
          assets: '1000000'
        }),
        createDepositEvent({
          id: 'deposit-range-2',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xbbb',
          blockTimestamp: 250,
          logIndex: 2,
          assets: '2000000'
        }),
        createDepositEvent({
          id: 'deposit-range-3',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xccc',
          blockTimestamp: 200,
          logIndex: 2,
          assets: '3000000'
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
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, {
      startTimestamp: 240,
      endTimestamp: 260
    })

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 80, 260)
    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xbbb',
        timestamp: 250,
        action: 'deposit',
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '2000000',
        assetAmountFormatted: 2,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '2000000',
        shareAmountFormatted: 0.000000000002,
        status: 'ok'
      }
    ])
  })

  it('seeks date-filtered scans from the selected end timestamp', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockImplementation(
      async (_userAddress: string, _version: string, _limitPerSource: number, maxTimestamp?: number) => ({
        deposits:
          maxTimestamp === 260
            ? [
                createDepositEvent({
                  id: 'older-in-range',
                  vaultAddress: UNDERLYING_VAULT,
                  transactionHash: '0xolder',
                  blockTimestamp: 250,
                  logIndex: 2,
                  assets: '2000000'
                })
              ]
            : [
                createDepositEvent({
                  id: 'newer-out-of-range',
                  vaultAddress: UNDERLYING_VAULT,
                  transactionHash: '0xnewer',
                  blockTimestamp: 500,
                  logIndex: 2,
                  assets: '1000000'
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
    )
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
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, {
      startTimestamp: 240,
      endTimestamp: 260
    })

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(USER_ADDRESS, 'all', 80, 260)
    expect(response.entries.map((entry) => entry.txHash)).toEqual(['0xolder'])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('keeps scanning when filtered chain matches are sparse', async () => {
    fetchRecentAddressScopedActivityEventsMock
      .mockResolvedValueOnce({
        deposits: Array.from({ length: 20 }, (_, index) =>
          createDepositEvent({
            id: `mainnet-recent-${index}`,
            vaultAddress: UNDERLYING_VAULT,
            transactionHash: `0xmainnet${index}`,
            blockTimestamp: 500 - index,
            logIndex: 2,
            assets: '1000000',
            chainId: 1
          })
        ),
        withdrawals: [],
        transfersIn: [],
        transfersOut: [],
        hasMoreDeposits: true,
        hasMoreWithdrawals: false,
        hasMoreTransfersIn: false,
        hasMoreTransfersOut: false
      })
      .mockResolvedValueOnce({
        deposits: [
          ...Array.from({ length: 20 }, (_, index) =>
            createDepositEvent({
              id: `mainnet-expanded-${index}`,
              vaultAddress: UNDERLYING_VAULT,
              transactionHash: `0xmainnet${index}`,
              blockTimestamp: 500 - index,
              logIndex: 2,
              assets: '1000000',
              chainId: 1
            })
          ),
          createDepositEvent({
            id: 'base-match',
            vaultAddress: UNDERLYING_VAULT,
            transactionHash: '0xbase',
            blockTimestamp: 300,
            logIndex: 2,
            assets: '2000000',
            chainId: 8453
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
          `8453:${UNDERLYING_VAULT}`,
          {
            address: UNDERLYING_VAULT,
            chainId: 8453,
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
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 1, 0, {
      chainId: 8453
    })

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenNthCalledWith(1, USER_ADDRESS, 'all', 80)
    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenNthCalledWith(2, USER_ADDRESS, 'all', 160)
    expect(response.entries.map((entry) => [entry.chainId, entry.txHash])).toEqual([[8453, '0xbase']])
    expect(response.pageInfo).toEqual({
      hasMore: false,
      nextOffset: null
    })
  })

  it('emits fallback transfer-in activity for address-scoped vault share transfers', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'transfer-in-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xtransferin',
          blockTimestamp: 410,
          logIndex: 2,
          value: '1230000000000000000',
          sender: INTERMEDIARY,
          receiver: USER_ADDRESS
        })
      ],
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
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xtransferin',
        timestamp: 410,
        action: 'transfer',
        transferDirection: 'in',
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '0',
        assetAmountFormatted: null,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '1230000000000000000',
        shareAmountFormatted: 1.23,
        status: 'ok'
      }
    ])
  })

  it('emits fallback transfer-out activity for address-scoped vault share transfers', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [
        createTransferEvent({
          id: 'transfer-out-raw-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xtransferout',
          blockTimestamp: 405,
          logIndex: 2,
          value: '2500000000000000000',
          sender: USER_ADDRESS,
          receiver: INTERMEDIARY
        })
      ],
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
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toMatchObject([
      {
        action: 'transfer',
        transferDirection: 'out',
        assetAmount: '0',
        assetAmountFormatted: null,
        shareAmount: '2500000000000000000',
        shareAmountFormatted: 2.5
      }
    ])
  })

  it('classifies direct v2 vault mint transfers as deposits from transaction input', async () => {
    mockDirectV2VaultRpc({
      transactionHash: '0xv2deposit',
      vaultAddress: UNDERLYING_VAULT,
      action: 'deposit',
      assetAmount: 4000000n
    })
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'v2-deposit-mint-transfer',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xv2deposit',
          blockTimestamp: 412,
          logIndex: 2,
          value: '3900000000000000000',
          sender: '0x0000000000000000000000000000000000000000',
          receiver: USER_ADDRESS
        })
      ],
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
            version: 'v2',
            category: 'stable',
            token: {
              address: USDT0,
              symbol: 'USDT',
              decimals: 6
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toMatchObject([
      {
        action: 'deposit',
        transferDirection: null,
        assetAmount: '4000000',
        assetAmountFormatted: 4,
        shareAmount: '3900000000000000000',
        shareAmountFormatted: 3.9
      }
    ])
  })

  it('classifies direct v2 vault burn transfers as withdrawals from transaction receipt output', async () => {
    mockDirectV2VaultRpc({
      transactionHash: '0xv2withdraw',
      vaultAddress: UNDERLYING_VAULT,
      action: 'withdraw',
      assetAmount: 4300000n,
      underlyingTokenAddress: USDT0
    })
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [
        createTransferEvent({
          id: 'v2-withdraw-burn-transfer',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xv2withdraw',
          blockTimestamp: 411,
          logIndex: 2,
          value: '4100000000000000000',
          sender: USER_ADDRESS,
          receiver: '0x0000000000000000000000000000000000000000'
        })
      ],
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
            version: 'v2',
            category: 'stable',
            token: {
              address: USDT0,
              symbol: 'USDT',
              decimals: 6
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toMatchObject([
      {
        action: 'withdraw',
        transferDirection: null,
        assetAmount: '4300000',
        assetAmountFormatted: 4.3,
        shareAmount: '4100000000000000000',
        shareAmountFormatted: 4.1
      }
    ])
  })

  it('does not emit fallback transfers when the same transaction family has higher-level activity', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [
        createDepositEvent({
          id: 'deposit-with-transfer-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xdeposittx',
          blockTimestamp: 415,
          logIndex: 3,
          assets: '1000000',
          shares: '1000000000000000000'
        })
      ],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'transfer-supporting-deposit-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xdeposittx',
          blockTimestamp: 415,
          logIndex: 2,
          value: '1000000000000000000',
          sender: '0x0000000000000000000000000000000000000000',
          receiver: USER_ADDRESS
        })
      ],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries.map((entry) => entry.action)).toEqual(['deposit'])
  })

  it('filters transfer fallback rows by activity type', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'transfer-filter-1',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xtransferfilter',
          blockTimestamp: 420,
          logIndex: 2,
          value: '1000000000000000000',
          sender: INTERMEDIARY,
          receiver: USER_ADDRESS
        })
      ],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())

    const { getHoldingsActivity } = await import('./activity')
    const transferResponse = await getHoldingsActivity(USER_ADDRESS, 'all', 10, 0, { type: 'transfer' })
    const depositResponse = await getHoldingsActivity(USER_ADDRESS, 'all', 10, 0, { type: 'deposit' })

    expect(transferResponse.entries).toHaveLength(1)
    expect(transferResponse.entries[0]?.action).toBe('transfer')
    expect(depositResponse.entries).toEqual([])
  })

  it('marks known rewards distributor transfers as reward claims while keeping transfer action type', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'ybs-reward-claim-transfer',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xrewardclaimybs',
          blockTimestamp: 430,
          logIndex: 2,
          value: '1200000000000000000',
          sender: YBS_REWARD_DISTRIBUTOR,
          receiver: USER_ADDRESS
        }),
        createTransferEvent({
          id: 'yyb-reward-claim-transfer',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xrewardclaimyyb',
          blockTimestamp: 420,
          logIndex: 2,
          value: '3400000000000000000',
          sender: YYB_REWARD_DISTRIBUTOR,
          receiver: USER_ADDRESS
        })
      ],
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
        ]
      ])
    )
    mockRewardDistributorRpc({
      '0xrewardclaimybs': YBS_REWARD_DISTRIBUTOR,
      '0xrewardclaimyyb': YYB_REWARD_DISTRIBUTOR
    })

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries.map((entry) => [entry.txHash, entry.action, entry.displayType])).toEqual([
      ['0xrewardclaimybs', 'transfer', 'reward_claim'],
      ['0xrewardclaimyyb', 'transfer', 'reward_claim']
    ])
  })

  it('collapses known yCRV zap transfer pairs to the incoming output leg with input token details', async () => {
    const outputVault = '0x27b5739e22ad9033bcbf192059122d163b60349d'

    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [
        createTransferEvent({
          id: 'ycrv-zap-transfer-in',
          vaultAddress: outputVault,
          transactionHash: '0xycrvzap',
          blockTimestamp: 430,
          logIndex: 9,
          value: '17760163460645012029397',
          sender: '0x0000000000000000000000000000000000000000',
          receiver: USER_ADDRESS
        })
      ],
      transfersOut: [
        createTransferEvent({
          id: 'ycrv-zap-transfer-out',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xycrvzap',
          blockTimestamp: 430,
          logIndex: 3,
          value: '8913214966288657814790',
          sender: USER_ADDRESS,
          receiver: YCRV_ZAP
        })
      ],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${outputVault}`,
          {
            address: outputVault,
            chainId: 1,
            version: 'v2',
            category: 'stable',
            token: {
              address: outputVault,
              symbol: 'st-yCRV',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    mockYcrvZapRpc({
      inputTokenAddress: UNDERLYING_VAULT,
      outputTokenAddress: outputVault,
      inputAmount: 8913214966288657814790n,
      inputTokenSymbol: 'yvCurve',
      inputTokenDecimals: 18
    })

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toEqual([
      {
        chainId: 1,
        txHash: '0xycrvzap',
        timestamp: 430,
        action: 'transfer',
        transferDirection: 'in',
        vaultAddress: outputVault,
        familyVaultAddress: outputVault,
        assetSymbol: 'st-yCRV',
        assetAmount: '0',
        assetAmountFormatted: null,
        inputTokenAddress: UNDERLYING_VAULT,
        inputTokenSymbol: 'yvCurve',
        inputTokenAmount: '8913214966288657814790',
        inputTokenAmountFormatted: 8913.214966288659,
        outputTokenAddress: outputVault,
        outputTokenSymbol: 'yvCurve',
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '17760163460645012029397',
        shareAmountFormatted: 17760.163460645013,
        status: 'ok'
      }
    ])
  })

  it('classifies yCRV Boosted Staker zaps as stake rows when only the outgoing leg is address scoped', async () => {
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: [
        createTransferEvent({
          id: 'ycrv-zap-outgoing-only',
          vaultAddress: UNDERLYING_VAULT,
          transactionHash: '0xycrvzapout',
          blockTimestamp: 425,
          logIndex: 3,
          value: '3000000000000000000',
          sender: USER_ADDRESS,
          receiver: YCRV_ZAP
        })
      ],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())
    mockYcrvZapRpc({
      inputTokenAddress: UNDERLYING_VAULT,
      outputTokenAddress: '0xe9a115b77a1057c918f997c32663fdce24fb873f',
      inputAmount: 3000000000000000000n,
      inputTokenSymbol: 'yvCurve',
      inputTokenDecimals: 18
    })

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity(USER_ADDRESS, 'all', 10)

    expect(response.entries).toMatchObject([
      {
        action: 'stake',
        transferDirection: null,
        inputTokenAddress: UNDERLYING_VAULT,
        inputTokenSymbol: 'yvCurve',
        inputTokenAmount: '3000000000000000000',
        inputTokenAmountFormatted: 3,
        outputTokenAddress: '0xe9a115b77a1057c918f997c32663fdce24fb873f',
        outputTokenSymbol: 'yCRV Boosted Staker',
        outputTokenAmount: null,
        outputTokenAmountFormatted: null
      }
    ])
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
        transferDirection: null,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        assetSymbol: 'USDC',
        assetAmount: '1072609',
        assetAmountFormatted: 1.072609,
        inputTokenAddress: null,
        inputTokenSymbol: null,
        inputTokenAmount: null,
        inputTokenAmountFormatted: null,
        outputTokenAddress: null,
        outputTokenSymbol: null,
        outputTokenAmount: null,
        outputTokenAmountFormatted: null,
        shareAmount: '849068037733633594470',
        shareAmountFormatted: 849.0680377336336,
        status: 'ok'
      }
    ])
  })
})
