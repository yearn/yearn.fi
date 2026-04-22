import { describe, expect, it } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import {
  buildProtocolReturnFamilyHistorySeries,
  buildProtocolReturnHistorySeries,
  buildProtocolReturnLedgers,
  buildReceiptPriceRequests,
  type HoldingsPnLSimpleVault,
  materializeProtocolReturnVaults
} from './pnlSimple'
import type { TRawPnlEvent } from './pnlTypes'

const USER = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const VAULT = '0x3333333333333333333333333333333333333333'
const ASSET = '0x4444444444444444444444444444444444444444'
const VAULT_KEY = toVaultKey(1, VAULT)
const ASSET_PRICE_KEY = `ethereum:${ASSET}`
const ONE = 10n ** 18n

const metadata = new Map<string, VaultMetadata>([
  [
    VAULT_KEY,
    {
      address: VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      token: {
        address: ASSET,
        symbol: 'TST',
        decimals: 18
      },
      decimals: 18
    }
  ]
])

function baseEvent(overrides: Partial<TRawPnlEvent>): TRawPnlEvent {
  const id = overrides.id ?? 'event'
  return {
    kind: 'transfer',
    id,
    chainId: 1,
    vaultAddress: VAULT,
    familyVaultAddress: VAULT,
    isStakingVault: false,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 0,
    transactionHash: `0x${id}`,
    transactionFrom: USER,
    sender: OTHER,
    receiver: USER,
    shares: 100n * ONE,
    scopes: {
      address: true,
      tx: false
    },
    ...overrides
  } as TRawPnlEvent
}

function materializeVault(args: {
  events: TRawPnlEvent[]
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  currentTimestamp?: number
}): HoldingsPnLSimpleVault {
  const currentTimestamp = args.currentTimestamp ?? 300
  const ledgers = buildProtocolReturnLedgers({
    events: args.events,
    userAddress: USER,
    metadata,
    ppsData: args.ppsData,
    priceData: args.priceData,
    currentTimestamp
  })
  return materializeProtocolReturnVaults({
    ledgers,
    metadata,
    ppsData: args.ppsData,
    currentTimestamp
  })[0]!
}

describe('pnl simple protocol return', () => {
  it('deduplicates receipt price fetches by underlying token and day bucket', () => {
    const requests = buildReceiptPriceRequests({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'transfer-in',
          blockTimestamp: 200,
          logIndex: 1,
          sender: OTHER,
          receiver: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'transfer-out',
          blockTimestamp: 300,
          logIndex: 2,
          sender: USER,
          receiver: OTHER
        })
      ],
      metadata,
      userAddress: USER,
      currentTimestamp: 172800
    })

    expect(requests).toEqual([
      {
        chainId: 1,
        address: ASSET,
        timestamps: [0, 86400]
      }
    ])
  })

  it('measures open deposit growth using receipt-time price as weight', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      ppsData: new Map([[VAULT_KEY, new Map([[300, 1.1]])]]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 2]])]])
    })

    expect(vault.status).toBe('ok')
    expect(vault.baselineUnderlying).toBe(100)
    expect(vault.growthUnderlying).toBeCloseTo(10)
    expect(vault.baselineWeightUsd).toBe(200)
    expect(vault.growthWeightUsd).toBeCloseTo(20)
    expect(vault.protocolReturnPct).toBeCloseTo(10)
    expect(vault.baselineExposureUnderlyingYears).toBeCloseTo(100 * (200 / (365 * 24 * 60 * 60)))
    expect(vault.annualizedProtocolReturnPct).toBeCloseTo((20 / (200 * (200 / (365 * 24 * 60 * 60)))) * 100)
  })

  it('measures realized withdrawal growth without current asset repricing', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'withdrawal',
          blockTimestamp: 200,
          logIndex: 1,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: USER
        })
      ],
      ppsData: new Map([[VAULT_KEY, new Map([[300, 1.1]])]]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 2]])]])
    })

    expect(vault.status).toBe('ok')
    expect(vault.shares).toBe('0')
    expect(vault.realizedGrowthUnderlying).toBe(10)
    expect(vault.unrealizedGrowthUnderlying).toBe(0)
    expect(vault.growthWeightUsd).toBe(20)
    expect(vault.protocolReturnPct).toBe(10)
  })

  it('annualizes using time-weighted baseline exposure for closed lots', () => {
    const secondsPerYear = 365 * 24 * 60 * 60
    const currentTimestamp = 100 + secondsPerYear
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'withdrawal',
          blockTimestamp: currentTimestamp,
          logIndex: 1,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: USER
        })
      ],
      ppsData: new Map([[VAULT_KEY, new Map([[currentTimestamp, 1.1]])]]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]]),
      currentTimestamp
    })

    expect(vault.baselineExposureUnderlyingYears).toBeCloseTo(100)
    expect(vault.baselineExposureWeightUsdYears).toBeCloseTo(100)
    expect(vault.growthWeightUsd).toBeCloseTo(10)
    expect(vault.annualizedProtocolReturnPct).toBeCloseTo(10)
  })

  it('uses PPS for transfer-only receipts and exits', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'transfer',
          id: 'transfer-in',
          blockTimestamp: 100,
          shares: 100n * ONE,
          sender: OTHER,
          receiver: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'transfer-out',
          blockTimestamp: 200,
          logIndex: 1,
          shares: 100n * ONE,
          sender: USER,
          receiver: OTHER
        })
      ],
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.2],
            [300, 1.2]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 3]])]])
    })

    expect(vault.status).toBe('ok')
    expect(vault.baselineUnderlying).toBe(100)
    expect(vault.realizedGrowthUnderlying).toBeCloseTo(20)
    expect(vault.baselineWeightUsd).toBe(300)
    expect(vault.growthWeightUsd).toBeCloseTo(60)
    expect(vault.protocolReturnPct).toBeCloseTo(20)
  })

  it('builds a daily growth series without deposit jumps in growth', () => {
    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit-1',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'deposit',
          id: 'deposit-2',
          blockTimestamp: 200,
          logIndex: 1,
          shares: 45454545454545454545n,
          assets: 50n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [150, 1.1],
            [200, 1.1],
            [250, 1.2]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[0, 1]])]]),
      ethPriceData: new Map([
        [0, 2],
        [100, 2],
        [150, 2],
        [200, 2],
        [250, 2]
      ]),
      timestamps: [100, 150, 200, 250]
    })

    expect(history).toHaveLength(4)
    expect(history[0]).toEqual({
      date: '1970-01-01',
      timestamp: 100,
      growthWeightUsd: 0,
      growthWeightEth: 0,
      protocolReturnPct: 0,
      annualizedProtocolReturnPct: null,
      growthIndex: 100
    })
    expect(history[1]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[1]?.growthWeightEth).toBeCloseTo(5)
    expect(history[1]?.protocolReturnPct).toBeCloseTo(10)
    expect(history[1]?.annualizedProtocolReturnPct).not.toBeNull()
    expect(history[1]?.growthIndex).toBeCloseTo(110)
    expect(history[2]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[2]?.growthWeightEth).toBeCloseTo(5)
    expect(history[2]?.protocolReturnPct).toBeCloseTo(6.6666666667)
    expect(history[2]?.growthIndex).toBeCloseTo(110)
    expect(history[3]?.growthWeightUsd).toBeCloseTo(24.5454545455)
    expect(history[3]?.growthWeightEth).toBeCloseTo(12.2727272727)
    expect(history[3]?.protocolReturnPct).toBeCloseTo(16.3636363636)
    expect(history[3]?.growthIndex).toBeCloseTo(120.6666666667)
  })

  it('includes current underlying and growth fields for single-vault history points', () => {
    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[0, 1]])]]),
      timestamps: [100, 200],
      selectedVaultKey: VAULT_KEY
    })

    expect(history[0]?.currentUnderlying).toBeCloseTo(100)
    expect(history[0]?.growthUnderlying).toBeCloseTo(0)
    expect(history[0]?.sharesFormatted).toBeCloseTo(100)
    expect(history[0]?.pricePerShare).toBeCloseTo(1)
    expect(history[1]?.currentUnderlying).toBeCloseTo(110)
    expect(history[1]?.growthUnderlying).toBeCloseTo(10)
    expect(history[1]?.sharesFormatted).toBeCloseTo(100)
    expect(history[1]?.pricePerShare).toBeCloseTo(1.1)
  })

  it('keeps ETH growth history available when another vault is missing receipt prices', () => {
    const MISSING_VAULT = '0x5555555555555555555555555555555555555555'
    const MISSING_ASSET = '0x6666666666666666666666666666666666666666'
    const MISSING_VAULT_KEY = toVaultKey(1, MISSING_VAULT)
    const mixedMetadata = new Map<string, VaultMetadata>([
      ...metadata.entries(),
      [
        MISSING_VAULT_KEY,
        {
          address: MISSING_VAULT,
          chainId: 1,
          version: 'v3',
          category: 'stable',
          token: {
            address: MISSING_ASSET,
            symbol: 'MISS',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])

    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'good-deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'deposit',
          id: 'missing-price-deposit',
          vaultAddress: MISSING_VAULT,
          familyVaultAddress: MISSING_VAULT,
          blockTimestamp: 100,
          logIndex: 1,
          transactionHash: '0xmissing-price-deposit',
          shares: 50n * ONE,
          assets: 50n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata: mixedMetadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ],
        [
          MISSING_VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[0, 1]])]]),
      ethPriceData: new Map([
        [0, 2],
        [100, 2],
        [200, 2]
      ]),
      timestamps: [100, 200]
    })

    expect(history[0]?.growthWeightEth).toBeCloseTo(0)
    expect(history[1]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[1]?.growthWeightEth).toBeCloseTo(5)
  })

  it('does not double count the ERC4626 mint transfer alongside a deposit event', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'transfer',
          id: 'mint-transfer',
          blockTimestamp: 100,
          transactionHash: '0xdeposit-tx',
          sender: ZERO_ADDRESS,
          receiver: USER,
          shares: 100n * ONE
        }),
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          transactionHash: '0xdeposit-tx',
          logIndex: 1,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [300, 1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]])
    })

    expect(vault.sharesFormatted).toBeCloseTo(100)
    expect(vault.baselineUnderlying).toBeCloseTo(100)
    expect(vault.receiptCount).toBe(1)
  })

  it('does not double count the ERC4626 burn transfer alongside a withdrawal event', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'burn-transfer',
          blockTimestamp: 200,
          blockNumber: 2,
          transactionHash: '0xwithdraw-tx',
          sender: USER,
          receiver: ZERO_ADDRESS,
          shares: 100n * ONE
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'withdrawal',
          blockTimestamp: 200,
          blockNumber: 2,
          transactionHash: '0xwithdraw-tx',
          logIndex: 1,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: USER
        })
      ],
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]])
    })

    expect(vault.sharesFormatted).toBeCloseTo(0)
    expect(vault.realizedBaselineUnderlying).toBeCloseTo(100)
    expect(vault.realizedGrowthUnderlying).toBeCloseTo(10)
    expect(vault.exitCount).toBe(1)
  })

  it('preserves accumulated growth across same-family staking unwrap transactions', () => {
    const UNDERLYING_VAULT = '0x182863131F9a4630fF9E27830d945B1413e347E8'
    const STAKING_VAULT = '0xd57aea3686d623da2dcebc87010a4f2f38ac7b15'
    const STAKING_VAULT_KEY = toVaultKey(1, UNDERLYING_VAULT)
    const stakingMetadata = new Map<string, VaultMetadata>([
      [
        STAKING_VAULT_KEY,
        {
          address: UNDERLYING_VAULT,
          chainId: 1,
          version: 'v3',
          category: 'stable',
          token: {
            address: ASSET,
            symbol: 'TST',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])
    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          vaultAddress: UNDERLYING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'unstake-withdrawal',
          transactionHash: '0xunstake',
          vaultAddress: STAKING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: true,
          blockTimestamp: 200,
          blockNumber: 2,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'unstake-transfer-in',
          transactionHash: '0xunstake',
          vaultAddress: UNDERLYING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: false,
          blockTimestamp: 200,
          blockNumber: 2,
          logIndex: 1,
          sender: STAKING_VAULT,
          receiver: USER,
          shares: 100n * ONE
        })
      ],
      userAddress: USER,
      metadata: stakingMetadata,
      ppsData: new Map([
        [
          STAKING_VAULT_KEY,
          new Map([
            [100, 1],
            [150, 1.1],
            [200, 1.1],
            [250, 1.2]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[0, 1]])]]),
      ethPriceData: new Map([
        [0, 2],
        [100, 2],
        [150, 2],
        [200, 2],
        [250, 2]
      ]),
      timestamps: [100, 150, 200, 250]
    })

    expect(history[1]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[1]?.growthWeightEth).toBeCloseTo(5)
    expect(history[2]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[2]?.growthWeightEth).toBeCloseTo(5)
    expect(history[3]?.growthWeightUsd).toBeCloseTo(20)
    expect(history[3]?.growthWeightEth).toBeCloseTo(10)
    expect(history[2]?.protocolReturnPct).toBeCloseTo(10)
  })

  it('treats mixed unstake transfer-ins identically regardless of transfer order', () => {
    const UNDERLYING_VAULT = '0x182863131F9a4630fF9E27830d945B1413e347E8'
    const STAKING_VAULT = '0xd57aea3686d623da2dcebc87010a4f2f38ac7b15'
    const STAKING_VAULT_KEY = toVaultKey(1, UNDERLYING_VAULT)
    const stakingMetadata = new Map<string, VaultMetadata>([
      [
        STAKING_VAULT_KEY,
        {
          address: UNDERLYING_VAULT,
          chainId: 1,
          version: 'v3',
          category: 'stable',
          token: {
            address: ASSET,
            symbol: 'TST',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])

    const materializeMixedUnstake = (order: 'bonus-first' | 'unwrap-first'): HoldingsPnLSimpleVault => {
      const bonusTransfer = baseEvent({
        kind: 'transfer',
        id: `bonus-${order}`,
        transactionHash: `0xmix-${order}`,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        isStakingVault: false,
        blockTimestamp: 200,
        blockNumber: 2,
        logIndex: order === 'bonus-first' ? 1 : 2,
        sender: STAKING_VAULT,
        receiver: USER,
        shares: 10n * ONE
      })
      const unwrapTransfer = baseEvent({
        kind: 'transfer',
        id: `unwrap-${order}`,
        transactionHash: `0xmix-${order}`,
        vaultAddress: UNDERLYING_VAULT,
        familyVaultAddress: UNDERLYING_VAULT,
        isStakingVault: false,
        blockTimestamp: 200,
        blockNumber: 2,
        logIndex: order === 'bonus-first' ? 2 : 1,
        sender: STAKING_VAULT,
        receiver: USER,
        shares: 100n * ONE
      })

      const events = [
        baseEvent({
          kind: 'deposit',
          id: `initial-${order}`,
          blockTimestamp: 50,
          vaultAddress: UNDERLYING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: `unstake-${order}`,
          transactionHash: `0xmix-${order}`,
          vaultAddress: STAKING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: true,
          blockTimestamp: 200,
          blockNumber: 2,
          logIndex: 0,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER
        }),
        ...(order === 'bonus-first' ? [bonusTransfer, unwrapTransfer] : [unwrapTransfer, bonusTransfer])
      ]

      const ppsData = new Map([
        [
          STAKING_VAULT_KEY,
          new Map([
            [50, 1],
            [200, 1.1],
            [300, 1.2]
          ])
        ]
      ])
      const priceData = new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [0, 1],
            [50, 1],
            [200, 1]
          ])
        ]
      ])
      const ledgers = buildProtocolReturnLedgers({
        events,
        userAddress: USER,
        metadata: stakingMetadata,
        ppsData,
        priceData,
        currentTimestamp: 300
      })

      return materializeProtocolReturnVaults({
        ledgers,
        metadata: stakingMetadata,
        ppsData,
        currentTimestamp: 300
      })[0]!
    }

    const bonusFirst = materializeMixedUnstake('bonus-first')
    const unwrapFirst = materializeMixedUnstake('unwrap-first')

    expect(bonusFirst.sharesFormatted).toBeCloseTo(110)
    expect(unwrapFirst.sharesFormatted).toBeCloseTo(110)
    expect(bonusFirst.receiptCount).toBe(2)
    expect(unwrapFirst.receiptCount).toBe(2)
    expect(bonusFirst.baselineUnderlying).toBeCloseTo(111)
    expect(unwrapFirst.baselineUnderlying).toBeCloseTo(111)
    expect(bonusFirst.growthUnderlying).toBeCloseTo(21)
    expect(unwrapFirst.growthUnderlying).toBeCloseTo(21)
    expect(bonusFirst.protocolReturnPct).toBeCloseTo(unwrapFirst.protocolReturnPct ?? 0)
    expect(bonusFirst.growthWeightUsd).toBeCloseTo(unwrapFirst.growthWeightUsd)
  })

  it('uses tx-scoped underlying deposit assets as the basis for router-mediated staking receipts', () => {
    const UNDERLYING_VAULT = '0x182863131F9a4630fF9E27830d945B1413e347E8'
    const STAKING_VAULT = '0xd57aea3686d623da2dcebc87010a4f2f38ac7b15'
    const STAKING_VAULT_KEY = toVaultKey(1, UNDERLYING_VAULT)
    const stakingMetadata = new Map<string, VaultMetadata>([
      [
        STAKING_VAULT_KEY,
        {
          address: UNDERLYING_VAULT,
          chainId: 1,
          version: 'v3',
          category: 'stable',
          token: {
            address: ASSET,
            symbol: 'TST',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])

    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'router-underlying-deposit',
          transactionHash: '0xrouter-stake',
          vaultAddress: UNDERLYING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: false,
          blockTimestamp: 200,
          blockNumber: 2,
          logIndex: 0,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: OTHER,
          sender: OTHER,
          scopes: {
            address: false,
            tx: true
          }
        }),
        baseEvent({
          kind: 'transfer',
          id: 'router-transfer-to-staking',
          transactionHash: '0xrouter-stake',
          vaultAddress: UNDERLYING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: false,
          blockTimestamp: 200,
          blockNumber: 2,
          logIndex: 1,
          sender: OTHER,
          receiver: STAKING_VAULT,
          shares: 100n * ONE,
          scopes: {
            address: false,
            tx: true
          }
        }),
        baseEvent({
          kind: 'deposit',
          id: 'user-staking-deposit',
          transactionHash: '0xrouter-stake',
          vaultAddress: STAKING_VAULT,
          familyVaultAddress: UNDERLYING_VAULT,
          isStakingVault: true,
          blockTimestamp: 200,
          blockNumber: 2,
          logIndex: 2,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: OTHER,
          scopes: {
            address: true,
            tx: true
          }
        })
      ],
      userAddress: USER,
      metadata: stakingMetadata,
      ppsData: new Map([
        [
          STAKING_VAULT_KEY,
          new Map([
            [200, 1.1],
            [250, 1.2]
          ])
        ]
      ]),
      priceData: new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [0, 1],
            [200, 1]
          ])
        ]
      ]),
      ethPriceData: new Map([
        [0, 2],
        [200, 2],
        [250, 2]
      ]),
      timestamps: [200, 250]
    })

    expect(history[0]?.growthWeightUsd).toBeCloseTo(0)
    expect(history[0]?.growthWeightEth).toBeCloseTo(0)
    expect(history[0]?.protocolReturnPct).toBeCloseTo(0)
    expect(history[0]?.growthIndex).toBeCloseTo(100)
    expect(history[1]?.growthWeightUsd).toBeCloseTo(10)
    expect(history[1]?.growthWeightEth).toBeCloseTo(5)
    expect(history[1]?.protocolReturnPct).toBeCloseTo(9.0909090909)
    expect(history[1]?.growthIndex).toBeCloseTo(109.0909090909)
  })

  it('builds family comparison history for selected vaults', () => {
    const ledgers = buildProtocolReturnLedgers({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]]),
      currentTimestamp: 200
    })
    const selectedVault = materializeProtocolReturnVaults({
      ledgers,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ]
      ]),
      currentTimestamp: 200
    })[0]!

    const familyHistory = buildProtocolReturnFamilyHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]]),
      timestamps: [100, 200],
      selectedVaults: [selectedVault]
    })

    expect(familyHistory).toHaveLength(1)
    expect(familyHistory[0]?.vaultAddress).toBe(VAULT)
    expect(familyHistory[0]?.dataPoints[0]?.protocolReturnPct).toBeCloseTo(0)
    expect(familyHistory[0]?.dataPoints[1]?.protocolReturnPct).toBeCloseTo(10)
    expect(familyHistory[0]?.dataPoints[0]?.growthIndex).toBeCloseTo(100)
    expect(familyHistory[0]?.dataPoints[1]?.growthIndex).toBeCloseTo(110)
  })

  it('stops emitting family growth index points after a vault is fully exited', () => {
    const ledgers = buildProtocolReturnLedgers({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'withdrawal',
          blockTimestamp: 200,
          blockNumber: 2,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]]),
      currentTimestamp: 300
    })
    const selectedVault = materializeProtocolReturnVaults({
      ledgers,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.1]
          ])
        ]
      ]),
      currentTimestamp: 300
    })[0]!

    const familyHistory = buildProtocolReturnFamilyHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'withdrawal',
          blockTimestamp: 200,
          blockNumber: 2,
          shares: 100n * ONE,
          assets: 110n * ONE,
          owner: USER
        })
      ],
      userAddress: USER,
      metadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]]),
      timestamps: [100, 200, 300],
      selectedVaults: [selectedVault]
    })

    expect(familyHistory[0]?.dataPoints[0]?.growthIndex).toBeCloseTo(100)
    expect(familyHistory[0]?.dataPoints[0]?.protocolReturnPct).toBeCloseTo(0)
    expect(familyHistory[0]?.dataPoints[1]?.growthIndex).toBeNull()
    expect(familyHistory[0]?.dataPoints[1]?.protocolReturnPct).toBeNull()
    expect(familyHistory[0]?.dataPoints[2]?.growthIndex).toBeNull()
    expect(familyHistory[0]?.dataPoints[2]?.protocolReturnPct).toBeNull()
  })

  it('builds an aggregate growth index that does not step down when a new position opens', () => {
    const SECOND_VAULT = '0x0000000000000000000000000000000000000002'
    const SECOND_ASSET = '0x0000000000000000000000000000000000000003'
    const secondVaultKey = toVaultKey(1, SECOND_VAULT)
    const secondAssetPriceKey = `ethereum:${SECOND_ASSET.toLowerCase()}`
    const extendedMetadata = new Map<string, VaultMetadata>([
      ...metadata,
      [
        secondVaultKey,
        {
          address: SECOND_VAULT,
          chainId: 1,
          version: 'v3',
          category: 'volatile',
          token: {
            address: SECOND_ASSET,
            symbol: 'ETH',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])

    const history = buildProtocolReturnHistorySeries({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'first-deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'deposit',
          id: 'second-deposit',
          vaultAddress: SECOND_VAULT,
          familyVaultAddress: SECOND_VAULT,
          blockTimestamp: 200,
          blockNumber: 2,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      userAddress: USER,
      metadata: extendedMetadata,
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.2]
          ])
        ],
        [
          secondVaultKey,
          new Map([
            [200, 1],
            [300, 1]
          ])
        ]
      ]),
      priceData: new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [100, 1],
            [200, 1],
            [300, 1]
          ])
        ],
        [
          secondAssetPriceKey,
          new Map([
            [200, 1],
            [300, 1]
          ])
        ]
      ]),
      timestamps: [100, 200, 300]
    })

    expect(history[0]?.protocolReturnPct).toBeCloseTo(0)
    expect(history[1]?.protocolReturnPct).toBeCloseTo(5)
    expect(history[2]?.protocolReturnPct).toBeCloseTo(10)
    expect(history[0]?.growthIndex).toBeCloseTo(100)
    expect(history[1]?.growthIndex).toBeCloseTo(110)
    expect(history[2]?.growthIndex).toBeCloseTo(115.5)
  })

  it('does not over-assign deposit basis when a same-tx mint is partially forwarded out', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'router-deposit',
          transactionHash: '0xrouter',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'router-forward',
          transactionHash: '0xrouter',
          blockTimestamp: 100,
          logIndex: 1,
          sender: USER,
          receiver: OTHER,
          shares: 20n * ONE
        })
      ],
      ppsData: new Map([[VAULT_KEY, new Map([[300, 1]])]]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]])
    })

    expect(vault.sharesFormatted).toBeCloseTo(80)
    expect(vault.realizedBaselineUnderlying).toBeCloseTo(20)
    expect(vault.unrealizedBaselineUnderlying).toBeCloseTo(80)
    expect(vault.growthUnderlying).toBeCloseTo(0)
    expect(vault.protocolReturnPct).toBeCloseTo(0)
  })

  it('does not realize fake gains on same-tx same-family rollover flows', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'initial-deposit',
          blockTimestamp: 50,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'rollover-withdrawal',
          transactionHash: '0xrollover',
          blockTimestamp: 100,
          blockNumber: 2,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER
        }),
        baseEvent({
          kind: 'deposit',
          id: 'rollover-redeposit',
          transactionHash: '0xrollover',
          blockTimestamp: 100,
          blockNumber: 2,
          logIndex: 1,
          shares: 90n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        })
      ],
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [50, 1],
            [100, 1],
            [300, 1]
          ])
        ]
      ]),
      priceData: new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [50, 1],
            [100, 1]
          ])
        ]
      ])
    })

    expect(vault.realizedGrowthUnderlying).toBeCloseTo(0)
    expect(vault.growthUnderlying).toBeCloseTo(-10)
    expect(vault.protocolReturnPct).toBeCloseTo(-5)
    expect(vault.baselineUnderlying).toBeCloseTo(200)
    expect(vault.sharesFormatted).toBeCloseTo(90)
  })

  it('closes positions when a user transfer-out is paired with a tx-scoped intermediary withdrawal', () => {
    const vault = materializeVault({
      events: [
        baseEvent({
          kind: 'deposit',
          id: 'deposit',
          blockTimestamp: 100,
          shares: 100n * ONE,
          assets: 100n * ONE,
          owner: USER,
          sender: USER
        }),
        baseEvent({
          kind: 'transfer',
          id: 'user-transfer-out',
          blockTimestamp: 200,
          blockNumber: 2,
          transactionHash: '0xrouter-exit',
          sender: USER,
          receiver: OTHER,
          shares: 100n * ONE,
          scopes: {
            address: true,
            tx: true
          }
        }),
        baseEvent({
          kind: 'withdrawal',
          id: 'router-withdrawal',
          blockTimestamp: 200,
          blockNumber: 2,
          transactionHash: '0xrouter-exit',
          owner: OTHER,
          shares: 100n * ONE,
          assets: 110n * ONE,
          scopes: {
            address: false,
            tx: true
          }
        })
      ],
      ppsData: new Map([
        [
          VAULT_KEY,
          new Map([
            [100, 1],
            [200, 1.1],
            [300, 1.1]
          ])
        ]
      ]),
      priceData: new Map([[ASSET_PRICE_KEY, new Map([[100, 1]])]])
    })

    expect(vault.sharesFormatted).toBeCloseTo(0)
    expect(vault.currentUnderlying).toBeCloseTo(0)
    expect(vault.realizedBaselineUnderlying).toBeCloseTo(100)
    expect(vault.realizedGrowthUnderlying).toBeCloseTo(10)
    expect(vault.unrealizedBaselineUnderlying).toBeCloseTo(0)
  })
})
