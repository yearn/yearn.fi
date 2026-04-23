import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRecentAddressScopedActivityEventsMock = vi.fn()
const fetchMultipleVaultsMetadataMock = vi.fn()

vi.mock('./graphql', () => ({
  fetchRecentAddressScopedActivityEvents: fetchRecentAddressScopedActivityEventsMock
}))

vi.mock('./vaults', () => ({
  fetchMultipleVaultsMetadata: fetchMultipleVaultsMetadataMock
}))

const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'
const HIDDEN_VAULT = '0x0000000000000000000000000000000000000123'
const UNKNOWN_VAULT = '0x0000000000000000000000000000000000000456'

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
    transactionFrom: '0x96A489A533bA0913dD8E507e6D985a45BC783566',
    owner: '0x96A489A533bA0913dD8E507e6D985a45BC783566',
    sender: '0x96A489A533bA0913dD8E507e6D985a45BC783566',
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
    transactionFrom: '0x96A489A533bA0913dD8E507e6D985a45BC783566',
    owner: '0x96A489A533bA0913dD8E507e6D985a45BC783566',
    assets: args.assets,
    shares: args.shares ?? args.assets
  }
}

describe('getHoldingsActivity', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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
      hasMoreDeposits: false,
      hasMoreWithdrawals: false
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
    const response = await getHoldingsActivity('0x96A489A533bA0913dD8E507e6D985a45BC783566', 'all', 4)

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(
      '0x96A489A533bA0913dD8E507e6D985a45BC783566',
      'all',
      20
    )
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
      hasMoreDeposits: false,
      hasMoreWithdrawals: false
    })
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())

    const { getHoldingsActivity } = await import('./activity')
    const response = await getHoldingsActivity('0x96A489A533bA0913dD8E507e6D985a45BC783566', 'all', 10)

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
      hasMoreDeposits: true,
      hasMoreWithdrawals: false
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
    const response = await getHoldingsActivity('0x96A489A533bA0913dD8E507e6D985a45BC783566', 'all', 1, 1)

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(
      '0x96A489A533bA0913dD8E507e6D985a45BC783566',
      'all',
      20
    )
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
})
