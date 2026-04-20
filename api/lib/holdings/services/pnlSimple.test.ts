import { describe, expect, it } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import {
  buildProtocolReturnLedgers,
  buildReceiptPriceRequests,
  type HoldingsPnLSimpleVault,
  materializeProtocolReturnVaults
} from './pnlSimple'
import type { TRawPnlEvent } from './pnlTypes'

const USER = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
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
  return {
    kind: 'transfer',
    id: 'event',
    chainId: 1,
    vaultAddress: VAULT,
    familyVaultAddress: VAULT,
    isStakingVault: false,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 0,
    transactionHash: '0xhash',
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
    priceData: args.priceData,
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
    expect(vault.protocolReturnUsd).toBeCloseTo(20)
    expect(vault.protocolReturnPct).toBeCloseTo(10)
    expect(vault.currentValueUsd).toBeCloseTo(220)
    expect(vault.estimatedBasisUsd).toBe(200)
    expect(vault.realizedPricePnlUsd).toBe(0)
    expect(vault.unrealizedPricePnlUsd).toBeCloseTo(20)
    expect(vault.priceBasedPnlUsd).toBeCloseTo(20)
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
    expect(vault.realizedExitValueUsd).toBe(220)
    expect(vault.realizedPricePnlUsd).toBe(20)
    expect(vault.unrealizedPricePnlUsd).toBe(0)
    expect(vault.priceBasedPnlUsd).toBe(20)
    expect(vault.protocolReturnPct).toBe(10)
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
    expect(vault.realizedExitValueUsd).toBeCloseTo(360)
    expect(vault.realizedPricePnlUsd).toBeCloseTo(60)
    expect(vault.priceBasedPnlUsd).toBeCloseTo(60)
    expect(vault.protocolReturnPct).toBeCloseTo(20)
  })

  it('includes asset repricing in realized price pnl while protocol return stays PPS-based', () => {
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
      priceData: new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [100, 2],
            [200, 3]
          ])
        ]
      ])
    })

    expect(vault.protocolReturnUsd).toBe(20)
    expect(vault.realizedExitValueUsd).toBe(330)
    expect(vault.realizedBasisUsd).toBe(200)
    expect(vault.realizedPricePnlUsd).toBe(130)
    expect(vault.priceBasedPnlUsd).toBe(130)
  })

  it('includes current asset repricing in unrealized price pnl', () => {
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
      priceData: new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [100, 2],
            [300, 3]
          ])
        ]
      ])
    })

    expect(vault.protocolReturnUsd).toBeCloseTo(20)
    expect(vault.currentValueUsd).toBeCloseTo(330)
    expect(vault.unrealizedBasisUsd).toBe(200)
    expect(vault.unrealizedPricePnlUsd).toBeCloseTo(130)
    expect(vault.priceBasedPnlUsd).toBeCloseTo(130)
  })
})
