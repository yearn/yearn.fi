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
const USER_ADDRESS = '0x96A489A533bA0913dD8E507e6D985a45BC783566'
const INTERMEDIARY = '0x4Fe93ebC4Ce6Ae4f81601cC7Ce7139023919E003'

function createDepositEvent(args: {
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
    sender: USER_ADDRESS,
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

describe('getHoldingsActivity', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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
        shareAmount: '849068037733633594470',
        shareAmountFormatted: 849.0680377336336,
        status: 'ok'
      }
    ])
  })
})
