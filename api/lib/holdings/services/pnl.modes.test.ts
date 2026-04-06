import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RawPnlEventContext } from './graphql'
import type { HoldingsPnLDrilldownResponse, HoldingsPnLResponse } from './pnl'

const VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const REWARD_DISTRIBUTOR = '0xb226c52eb411326cdb54824a88abafdaaff16d3d'
const REWARD_VAULT = '0xbf319ddc2edc1eb6fdf9910e39b37be221c8805f'
const USER = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
const ROUTER = '0x1111111111111111111111111111111111111111'
const PRICE_KEY = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

const fetchRawUserPnlEventsMock = vi.fn<() => Promise<RawPnlEventContext>>()
const fetchMultipleVaultsMetadataMock = vi.fn()
const fetchMultipleVaultsPPSMock = vi.fn()
const fetchHistoricalPricesMock = vi.fn()

vi.mock('./graphql', async () => {
  const actual = await vi.importActual<typeof import('./graphql')>('./graphql')
  return {
    ...actual,
    fetchRawUserPnlEvents: fetchRawUserPnlEventsMock
  }
})

vi.mock('./vaults', async () => {
  const actual = await vi.importActual<typeof import('./vaults')>('./vaults')
  return {
    ...actual,
    fetchMultipleVaultsMetadata: fetchMultipleVaultsMetadataMock
  }
})

vi.mock('./kong', async () => {
  const actual = await vi.importActual<typeof import('./kong')>('./kong')
  return {
    ...actual,
    fetchMultipleVaultsPPS: fetchMultipleVaultsPPSMock
  }
})

vi.mock('./defillama', async () => {
  const actual = await vi.importActual<typeof import('./defillama')>('./defillama')
  return {
    ...actual,
    fetchHistoricalPrices: fetchHistoricalPricesMock
  }
})

function createTransferInContext(): RawPnlEventContext {
  return {
    addressEvents: {
      deposits: [
        {
          id: 'anchor-deposit',
          vaultAddress: VAULT,
          chainId: 1,
          blockNumber: 3,
          blockTimestamp: 300,
          logIndex: 1,
          transactionHash: '0xanchor-deposit',
          transactionFrom: USER,
          owner: USER,
          sender: USER,
          assets: '1100000',
          shares: '1000000'
        }
      ],
      withdrawals: [],
      transfersIn: [
        {
          id: 'unknown-transfer-in',
          vaultAddress: VAULT,
          chainId: 1,
          blockNumber: 1,
          blockTimestamp: 100,
          logIndex: 1,
          transactionHash: '0xtransfer-in',
          transactionFrom: ROUTER,
          sender: ROUTER,
          receiver: USER,
          value: '100000000'
        }
      ],
      transfersOut: []
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: []
    }
  }
}

function createUnknownWithdrawalContext(): RawPnlEventContext {
  return {
    addressEvents: {
      deposits: [],
      withdrawals: [
        {
          id: 'unknown-withdrawal',
          vaultAddress: VAULT,
          chainId: 1,
          blockNumber: 2,
          blockTimestamp: 200,
          logIndex: 1,
          transactionHash: '0xwithdraw',
          transactionFrom: USER,
          owner: USER,
          assets: '120000000',
          shares: '100000000'
        }
      ],
      transfersIn: createTransferInContext().addressEvents.transfersIn,
      transfersOut: []
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: []
    }
  }
}

function createTransferOnlyContext(): RawPnlEventContext {
  return {
    addressEvents: {
      deposits: [],
      withdrawals: [],
      transfersIn: createTransferInContext().addressEvents.transfersIn,
      transfersOut: []
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: []
    }
  }
}

function createRewardTransferInContext(): RawPnlEventContext {
  const rewardTransferIn = {
    id: 'reward-transfer-in',
    vaultAddress: REWARD_VAULT,
    chainId: 1,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xreward-transfer-in',
    transactionFrom: REWARD_DISTRIBUTOR,
    sender: REWARD_DISTRIBUTOR,
    receiver: USER,
    value: '100000000'
  }

  return {
    addressEvents: {
      deposits: [],
      withdrawals: [],
      transfersIn: [rewardTransferIn],
      transfersOut: []
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: [rewardTransferIn]
    }
  }
}

function createTransferOutContext(): RawPnlEventContext {
  return {
    addressEvents: {
      deposits: createTransferInContext().addressEvents.deposits,
      withdrawals: [],
      transfersIn: createTransferInContext().addressEvents.transfersIn,
      transfersOut: [
        {
          id: 'unknown-transfer-out',
          vaultAddress: VAULT,
          chainId: 1,
          blockNumber: 2,
          blockTimestamp: 200,
          logIndex: 1,
          transactionHash: '0xtransfer-out',
          transactionFrom: USER,
          sender: USER,
          receiver: ROUTER,
          value: '100000000'
        }
      ]
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: []
    }
  }
}

function configureServiceMocks(
  rawContext: RawPnlEventContext,
  overrides?: {
    vaultAddress?: string
    metadata?: {
      tokenAddress: string
      symbol: string
      decimals: number
      shareDecimals?: number
      category?: 'stable' | 'volatile'
    }
    ppsTimeline?: Map<number, number>
    priceKey?: string
    prices?: Map<number, number>
  }
): void {
  const vaultAddress = overrides?.vaultAddress ?? VAULT
  const metadata = overrides?.metadata ?? {
    tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
    shareDecimals: 6,
    category: 'stable' as const
  }
  const ppsTimeline =
    overrides?.ppsTimeline ??
    new Map([
      [100, 1],
      [200, 1.2],
      [300, 1.1]
    ])
  const priceKey = overrides?.priceKey ?? PRICE_KEY
  const prices =
    overrides?.prices ??
    new Map([
      [100, 2],
      [200, 3],
      [300, 3]
    ])

  fetchRawUserPnlEventsMock.mockResolvedValue(rawContext)
  fetchMultipleVaultsMetadataMock.mockResolvedValue(
    new Map([
      [
        `1:${vaultAddress}`,
        {
          address: vaultAddress,
          chainId: 1,
          version: 'v3',
          token: {
            address: metadata.tokenAddress,
            symbol: metadata.symbol,
            decimals: metadata.decimals
          },
          category: metadata.category ?? 'volatile',
          decimals: metadata.shareDecimals ?? metadata.decimals
        }
      ]
    ])
  )
  fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, ppsTimeline]]))
  fetchHistoricalPricesMock.mockResolvedValue(new Map([[priceKey, prices]]))
}

async function importPnlModule() {
  vi.resetModules()
  return import('./pnl')
}

async function getSingleVaultResponse(
  rawContext: RawPnlEventContext,
  unknownMode?: 'strict' | 'zero_basis' | 'windfall',
  overrides?: Parameters<typeof configureServiceMocks>[1]
): Promise<HoldingsPnLResponse> {
  configureServiceMocks(rawContext, overrides)
  const { getHoldingsPnL } = await importPnlModule()
  const response = await getHoldingsPnL(USER, 'all', unknownMode)
  expect(response.vaults).toHaveLength(1)
  return response
}

async function getSingleVaultDrilldownResponse(
  rawContext: RawPnlEventContext,
  unknownMode?: 'strict' | 'zero_basis' | 'windfall',
  overrides?: Parameters<typeof configureServiceMocks>[1]
): Promise<HoldingsPnLDrilldownResponse> {
  configureServiceMocks(rawContext, overrides)
  const { getHoldingsPnLDrilldown } = await importPnlModule()
  const response = await getHoldingsPnLDrilldown(USER, 'all', unknownMode)
  expect(response.vaults).toHaveLength(1)
  return response
}

describe('getHoldingsPnL unknown transfer-in modes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('defaults to windfall and splits free transfer-ins into windfall plus market unrealized pnl', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultResponse(createTransferInContext())
    const vault = response.vaults[0]

    expect(response.unknownTransferInPnlMode).toBe('windfall')
    expect(response.summary.totalUnknownCostBasisValueUsd).toBe(0)
    expect(response.summary.totalWindfallPnlUsd).toBeCloseTo(200)
    expect(response.summary.totalUnrealizedPnlUsd).toBeCloseTo(130)
    expect(response.summary.totalPnlUsd).toBeCloseTo(130)
    expect(response.summary.totalEconomicGainUsd).toBeCloseTo(330)
    expect(vault.windfallPnlUsd).toBeCloseTo(200)
    expect(vault.unrealizedPnlUsd).toBeCloseTo(130)
    expect(vault.totalPnlUsd).toBeCloseTo(130)
    expect(vault.totalEconomicGainUsd).toBeCloseTo(330)
  })

  it('uses paged sequential event fetching by default and allows explicit overrides', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)
    configureServiceMocks(createTransferInContext())

    const { getHoldingsPnL } = await importPnlModule()

    await getHoldingsPnL(USER)
    expect(fetchRawUserPnlEventsMock).toHaveBeenLastCalledWith(USER, 'all', undefined, 'seq', 'paged')

    await getHoldingsPnL(USER, 'all', 'windfall', 'parallel', 'all')
    expect(fetchRawUserPnlEventsMock).toHaveBeenLastCalledWith(USER, 'all', undefined, 'parallel', 'all')
  })

  it('filters versioned pnl responses using authoritative vault metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)
    configureServiceMocks(createTransferInContext())

    const { getHoldingsPnL } = await importPnlModule()

    const v2Response = await getHoldingsPnL(USER, 'v2')
    expect(v2Response.summary.totalVaults).toBe(0)
    expect(v2Response.vaults).toEqual([])
    expect(fetchRawUserPnlEventsMock).toHaveBeenLastCalledWith(USER, 'all', undefined, 'seq', 'paged')

    const v3Response = await getHoldingsPnL(USER, 'v3')
    expect(v3Response.summary.totalVaults).toBe(1)
    expect(v3Response.vaults[0]?.vaultAddress).toBe(VAULT)
    expect(fetchRawUserPnlEventsMock).toHaveBeenLastCalledWith(USER, 'all', undefined, 'seq', 'paged')
  })

  it('treats unknown transfer-ins as full unrealized pnl in zero-basis mode', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultResponse(createTransferInContext(), 'zero_basis')
    const vault = response.vaults[0]

    expect(response.summary.totalUnknownCostBasisValueUsd).toBe(0)
    expect(response.summary.totalWindfallPnlUsd).toBe(0)
    expect(response.summary.totalUnrealizedPnlUsd).toBeCloseTo(330)
    expect(response.summary.totalPnlUsd).toBeCloseTo(330)
    expect(response.summary.totalEconomicGainUsd).toBeCloseTo(330)
    expect(vault.windfallPnlUsd).toBe(0)
    expect(vault.unrealizedPnlUsd).toBeCloseTo(330)
    expect(vault.totalPnlUsd).toBeCloseTo(330)
    expect(vault.totalEconomicGainUsd).toBeCloseTo(330)
  })

  it('treats recognized reward transfer-ins as complete zero-basis lots in windfall mode', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultDrilldownResponse(createRewardTransferInContext(), 'windfall', {
      vaultAddress: REWARD_VAULT
    })
    const vault = response.vaults[0]

    expect(vault.costBasisStatus).toBe('complete')
    expect(vault.windfallPnlUsd).toBe(0)
    expect(vault.unrealizedPnlUsd).toBeCloseTo(330)
    expect(vault.totalPnlUsd).toBeCloseTo(330)
    expect(vault.totalEconomicGainUsd).toBeCloseTo(330)
    expect(vault.eventCounts.rewardTransfersIn).toBe(1)
    expect(vault.eventCounts.externalTransfersIn).toBe(0)
    expect(vault.rewardTransferInEntries).toHaveLength(1)
    expect(vault.rewardTransferInEntries[0]).toMatchObject({
      distributor: REWARD_DISTRIBUTOR,
      location: 'vault',
      sharesFormatted: 100,
      receiptValueUsd: 200
    })
    expect(vault.unknownTransferInEntries).toEqual([])
    expect(vault.currentLots.vault).toHaveLength(1)
    expect(vault.currentLots.vault[0]?.costBasis).toBe('0')
    expect(vault.currentLots.vault[0]?.costBasisUsd).toBe(0)
    expect(vault.currentLots.vault[0]?.currentValueUsd).toBeCloseTo(330)
    expect(vault.journal).toHaveLength(1)
    expect(vault.journal[0]).toMatchObject({
      txHash: '0xreward-transfer-in',
      view: 'reward_in_vault',
      rewardInVaultShares: '100000000',
      unknownInVaultShares: '0'
    })
  })

  it('preserves strict-mode unknown cost basis behavior', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultResponse(createTransferInContext(), 'strict')
    const vault = response.vaults[0]

    expect(response.summary.totalUnknownCostBasisValueUsd).toBeCloseTo(330)
    expect(response.summary.totalWindfallPnlUsd).toBe(0)
    expect(response.summary.totalUnrealizedPnlUsd).toBe(0)
    expect(response.summary.totalPnlUsd).toBe(0)
    expect(response.summary.totalEconomicGainUsd).toBe(0)
    expect(vault.unknownCostBasisValueUsd).toBeCloseTo(330)
    expect(vault.totalPnlUsd).toBe(0)
    expect(vault.totalEconomicGainUsd).toBe(0)
  })

  it('values transfer-only current holdings without fetching historical receipt prices', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const windfallResponse = await getSingleVaultResponse(createTransferOnlyContext(), 'windfall')
    const zeroBasisResponse = await getSingleVaultResponse(createTransferOnlyContext(), 'zero_basis')
    const strictResponse = await getSingleVaultResponse(createTransferOnlyContext(), 'strict')

    expect(fetchHistoricalPricesMock).toHaveBeenNthCalledWith(
      1,
      [{ chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }],
      [300]
    )
    expect(fetchHistoricalPricesMock).toHaveBeenNthCalledWith(
      2,
      [{ chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }],
      [300]
    )
    expect(fetchHistoricalPricesMock).toHaveBeenNthCalledWith(
      3,
      [{ chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }],
      [300]
    )

    expect(windfallResponse.summary.totalCurrentValueUsd).toBeCloseTo(330)
    expect(windfallResponse.summary.totalWindfallPnlUsd).toBeCloseTo(330)
    expect(windfallResponse.summary.totalPnlUsd).toBe(0)
    expect(windfallResponse.summary.totalEconomicGainUsd).toBeCloseTo(330)

    expect(zeroBasisResponse.summary.totalCurrentValueUsd).toBeCloseTo(330)
    expect(zeroBasisResponse.summary.totalUnrealizedPnlUsd).toBeCloseTo(330)
    expect(zeroBasisResponse.summary.totalPnlUsd).toBeCloseTo(330)
    expect(zeroBasisResponse.summary.totalEconomicGainUsd).toBeCloseTo(330)

    expect(strictResponse.summary.totalCurrentValueUsd).toBeCloseTo(330)
    expect(strictResponse.summary.totalUnknownCostBasisValueUsd).toBeCloseTo(330)
    expect(strictResponse.summary.totalPnlUsd).toBe(0)
    expect(strictResponse.summary.totalEconomicGainUsd).toBe(0)
  })

  it('computes realized pnl for unknown withdrawals in zero-basis and windfall modes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const zeroBasisResponse = await getSingleVaultResponse(createUnknownWithdrawalContext(), 'zero_basis')
    const windfallResponse = await getSingleVaultResponse(createUnknownWithdrawalContext(), 'windfall')

    expect(zeroBasisResponse.summary.totalRealizedPnlUsd).toBeCloseTo(360)
    expect(zeroBasisResponse.summary.totalWindfallPnlUsd).toBe(0)
    expect(zeroBasisResponse.summary.totalPnlUsd).toBeCloseTo(360)
    expect(zeroBasisResponse.summary.totalEconomicGainUsd).toBeCloseTo(360)

    expect(windfallResponse.summary.totalWindfallPnlUsd).toBeCloseTo(200)
    expect(windfallResponse.summary.totalRealizedPnlUsd).toBeCloseTo(160)
    expect(windfallResponse.summary.totalPnlUsd).toBeCloseTo(160)
    expect(windfallResponse.summary.totalEconomicGainUsd).toBeCloseTo(360)
  })

  it('does not keep windfall on unknown shares that later leave through external transfers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const zeroBasisResponse = await getSingleVaultResponse(createTransferOutContext(), 'zero_basis')
    const windfallResponse = await getSingleVaultResponse(createTransferOutContext(), 'windfall')

    expect(zeroBasisResponse.summary.totalPnlUsd).toBe(0)
    expect(zeroBasisResponse.summary.totalEconomicGainUsd).toBe(0)
    expect(windfallResponse.summary.totalWindfallPnlUsd).toBe(0)
    expect(windfallResponse.summary.totalPnlUsd).toBe(0)
    expect(windfallResponse.summary.totalEconomicGainUsd).toBe(0)
  })

  it('counts underlying token price appreciation for known-basis deposits in usd pnl', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultResponse(
      {
        addressEvents: {
          deposits: [
            {
              id: 'known-deposit',
              vaultAddress: VAULT,
              chainId: 1,
              blockNumber: 1,
              blockTimestamp: 100,
              logIndex: 1,
              transactionHash: '0xknown-deposit',
              transactionFrom: USER,
              owner: USER,
              sender: USER,
              assets: '1000000000000000000',
              shares: '1000000000000000000'
            }
          ],
          withdrawals: [],
          transfersIn: [],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: []
        }
      },
      'windfall',
      {
        metadata: {
          tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18,
          category: 'volatile'
        },
        ppsTimeline: new Map([
          [100, 1],
          [300, 1]
        ]),
        priceKey: 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        prices: new Map([
          [100, 2000],
          [300, 3000]
        ])
      }
    )

    const vault = response.vaults[0]

    expect(vault.unrealizedPnlUnderlying).toBeCloseTo(0)
    expect(vault.unrealizedPnlUsd).toBeCloseTo(1000)
    expect(vault.totalPnlUsd).toBeCloseTo(1000)
    expect(vault.totalEconomicGainUsd).toBeCloseTo(1000)
    expect(response.summary.totalUnrealizedPnlUsd).toBeCloseTo(1000)
  })

  it('adds explicit underlying and known-basis usd fields to vault rows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultResponse(
      {
        addressEvents: {
          deposits: [
            {
              id: 'known-deposit',
              vaultAddress: VAULT,
              chainId: 1,
              blockNumber: 1,
              blockTimestamp: 100,
              logIndex: 1,
              transactionHash: '0xknown-deposit',
              transactionFrom: USER,
              owner: USER,
              sender: USER,
              assets: '1000000000000000000',
              shares: '1000000000000000000'
            }
          ],
          withdrawals: [],
          transfersIn: [],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: []
        }
      },
      'windfall',
      {
        metadata: {
          tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18
        },
        ppsTimeline: new Map([
          [100, 1],
          [300, 1]
        ]),
        priceKey: 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        prices: new Map([
          [100, 2000],
          [300, 3000]
        ])
      }
    )

    expect(response.vaults[0]).toMatchObject({
      currentUnderlying: 1,
      vaultUnderlying: 1,
      stakedUnderlying: 0,
      currentKnownUnderlying: 1,
      currentUnknownUnderlying: 0,
      knownCostBasisUnderlying: 1,
      knownCostBasisUsd: 2000
    })
    expect(response.vaults[0]?.metadata).toMatchObject({
      symbol: 'WETH',
      decimals: 18,
      assetDecimals: 18
    })
  })

  it('returns drilldown lots, unknown-basis receipts, and journal rows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(300_000)

    const response = await getSingleVaultDrilldownResponse(createTransferInContext(), 'windfall')
    const vault = response.vaults[0]

    expect(vault.currentLots.vault).toHaveLength(2)
    expect(vault.currentLots.staked).toHaveLength(0)
    expect(vault.unknownTransferInEntries).toHaveLength(1)
    expect(vault.unknownTransferInEntries[0]).toMatchObject({
      location: 'vault',
      sharesFormatted: 100,
      receiptValueUsd: 200
    })
    expect(vault.realizedEntries).toHaveLength(0)
    expect(vault.journal).toHaveLength(2)
    expect(vault.journal[0]).toMatchObject({
      txHash: '0xtransfer-in',
      vaultLotsAfter: {
        totalShares: '100000000',
        unknownShares: '100000000'
      }
    })
  })

  it('splits summary totals by stable and volatile vault categories', async () => {
    const { summarizePnlVaults } = await import('./pnlValuation')

    const summary = summarizePnlVaults([
      {
        chainId: 1,
        vaultAddress: '0x1111111111111111111111111111111111111111',
        stakingVaultAddress: null,
        status: 'ok',
        costBasisStatus: 'complete',
        unknownTransferInPnlMode: 'windfall',
        shares: '1',
        sharesFormatted: 1,
        vaultShares: '1',
        vaultSharesFormatted: 1,
        stakedShares: '0',
        stakedSharesFormatted: 0,
        knownCostBasisShares: '1',
        unknownCostBasisShares: '0',
        pricePerShare: 1,
        tokenPrice: 1,
        currentUnderlying: 10,
        vaultUnderlying: 10,
        stakedUnderlying: 0,
        currentKnownUnderlying: 10,
        currentUnknownUnderlying: 0,
        knownCostBasisUnderlying: 10,
        knownCostBasisUsd: 10,
        currentValueUsd: 10,
        vaultValueUsd: 10,
        stakedValueUsd: 0,
        unknownCostBasisValueUsd: 0,
        windfallPnlUsd: 0,
        realizedPnlUnderlying: 0,
        realizedPnlUsd: 0,
        unrealizedPnlUnderlying: 0,
        unrealizedPnlUsd: 12,
        totalPnlUsd: 12,
        totalEconomicGainUsd: 12,
        totalDepositedUnderlying: 0,
        totalWithdrawnUnderlying: 0,
        eventCounts: {
          underlyingDeposits: 0,
          underlyingWithdrawals: 0,
          stakes: 0,
          unstakes: 0,
          rewardTransfersIn: 0,
          externalTransfersIn: 0,
          externalTransfersOut: 0,
          migrationsIn: 0,
          migrationsOut: 0,
          unknownCostBasisTransfersIn: 0,
          withdrawalsWithUnknownCostBasis: 0
        },
        metadata: {
          symbol: 'USDC',
          decimals: 6,
          assetDecimals: 6,
          tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          category: 'stable'
        }
      },
      {
        chainId: 1,
        vaultAddress: '0x2222222222222222222222222222222222222222',
        stakingVaultAddress: null,
        status: 'ok',
        costBasisStatus: 'complete',
        unknownTransferInPnlMode: 'windfall',
        shares: '1',
        sharesFormatted: 1,
        vaultShares: '1',
        vaultSharesFormatted: 1,
        stakedShares: '0',
        stakedSharesFormatted: 0,
        knownCostBasisShares: '1',
        unknownCostBasisShares: '0',
        pricePerShare: 1,
        tokenPrice: 1,
        currentUnderlying: 20,
        vaultUnderlying: 20,
        stakedUnderlying: 0,
        currentKnownUnderlying: 20,
        currentUnknownUnderlying: 0,
        knownCostBasisUnderlying: 20,
        knownCostBasisUsd: 17,
        currentValueUsd: 20,
        vaultValueUsd: 20,
        stakedValueUsd: 0,
        unknownCostBasisValueUsd: 0,
        windfallPnlUsd: 3,
        realizedPnlUnderlying: 0,
        realizedPnlUsd: 0,
        unrealizedPnlUnderlying: 0,
        unrealizedPnlUsd: 5,
        totalPnlUsd: 5,
        totalEconomicGainUsd: 8,
        totalDepositedUnderlying: 0,
        totalWithdrawnUnderlying: 0,
        eventCounts: {
          underlyingDeposits: 0,
          underlyingWithdrawals: 0,
          stakes: 0,
          unstakes: 0,
          rewardTransfersIn: 0,
          externalTransfersIn: 0,
          externalTransfersOut: 0,
          migrationsIn: 0,
          migrationsOut: 0,
          unknownCostBasisTransfersIn: 0,
          withdrawalsWithUnknownCostBasis: 0
        },
        metadata: {
          symbol: 'WETH',
          decimals: 18,
          assetDecimals: 18,
          tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          category: 'volatile'
        }
      }
    ])

    expect(summary.totalPnlUsd).toBe(17)
    expect(summary.totalEconomicGainUsd).toBe(20)
    expect(summary.byCategory.stable.totalPnlUsd).toBe(12)
    expect(summary.byCategory.stable.totalEconomicGainUsd).toBe(12)
    expect(summary.byCategory.volatile.totalPnlUsd).toBe(5)
    expect(summary.byCategory.volatile.totalEconomicGainUsd).toBe(8)
  })
})
