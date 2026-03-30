import { describe, expect, it } from 'vitest'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'
import { buildSyntheticBaseVault, buildYvUsdVaultsModel, getYvUsdTvlBreakdown } from './useYvUsdVaults.helpers'

const UNDERLYING_ASSET = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  chainId: 1
} as const

const UNLOCKED_SNAPSHOT = {
  address: YVUSD_UNLOCKED_ADDRESS,
  apiVersion: '3.0.4',
  decimals: 6,
  totalAssets: '1000000000',
  asset: UNDERLYING_ASSET,
  apy: {
    net: 0.04,
    weeklyNet: 0.05,
    monthlyNet: 0.04,
    pricePerShare: '1010000',
    weeklyPricePerShare: '1008000',
    monthlyPricePerShare: '1005000'
  },
  tvl: {
    close: 1000
  },
  fees: {
    managementFee: 0,
    performanceFee: 0
  },
  meta: {
    kind: 'Multi Strategy',
    type: 'Automated Yearn Vault',
    category: 'Stablecoin',
    token: UNDERLYING_ASSET,
    isRetired: false,
    isHidden: true,
    isBoosted: false
  },
  composition: [
    {
      address: '0x5f9DBa2805411a8382FDb4E69d4f2Da8EFaF1F89',
      name: 'Infinifi sIUSD Morpho Looper',
      status: 'active',
      currentDebt: '250000000',
      totalDebt: '250000000',
      totalGain: '0',
      totalLoss: '0',
      performanceFee: 0,
      lastReport: 1_773_076_679,
      performance: {
        oracle: {
          apy: 0,
          apr: 0
        },
        historical: {
          net: 0.02,
          weeklyNet: 0.03,
          monthlyNet: 0.02,
          inceptionNet: 0.01
        }
      }
    }
  ],
  debts: []
} as const

const LOCKED_SNAPSHOT = {
  address: YVUSD_LOCKED_ADDRESS,
  apiVersion: '3.0.4',
  decimals: 6,
  totalAssets: '500000000',
  asset: {
    address: YVUSD_UNLOCKED_ADDRESS,
    name: 'USD yVault',
    symbol: 'yvUSD',
    decimals: 6,
    chainId: 1
  },
  apy: {
    net: 0.5,
    weeklyNet: 0.52,
    monthlyNet: 0.5,
    pricePerShare: '1030000',
    weeklyPricePerShare: '1020000',
    monthlyPricePerShare: '1010000'
  },
  tvl: {
    close: 500
  },
  fees: {
    managementFee: 0,
    performanceFee: 0
  },
  meta: {
    kind: 'Multi Strategy',
    type: 'Automated Yearn Vault',
    category: 'Stablecoin',
    token: {
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'USD yVault',
      symbol: 'yvUSD',
      decimals: 6,
      chainId: 1
    },
    isRetired: false,
    isHidden: true,
    isBoosted: false
  },
  performance: {
    estimated: {
      apr: 0.1,
      apy: 0.11,
      type: 'yvusd-estimated-apr',
      components: {
        baseNetAPR: 0.08,
        lockerBonusAPR: 0.03
      }
    },
    historical: {
      net: 0.5,
      weeklyNet: 0.52,
      monthlyNet: 0.5,
      inceptionNet: 0.4
    }
  },
  composition: [],
  debts: []
} as const

const LOCKED_LIST_BASE_VAULT = {
  chainId: 1,
  address: YVUSD_LOCKED_ADDRESS,
  name: 'Locked yvUSD',
  symbol: 'Locked yvUSD',
  apiVersion: '3.0.4',
  decimals: 6,
  asset: {
    address: YVUSD_UNLOCKED_ADDRESS,
    name: 'USD yVault',
    symbol: 'yvUSD',
    decimals: 6
  },
  tvl: 500,
  performance: {
    oracle: {
      apr: 0.02,
      apy: 0.02
    },
    estimated: {
      apr: 0.1,
      apy: 0.11,
      type: 'yvusd-estimated-apr',
      components: {}
    },
    historical: {
      net: 0.5,
      weeklyNet: 0.52,
      monthlyNet: 0.5,
      inceptionNet: 0.4
    }
  },
  fees: {
    managementFee: 0,
    performanceFee: 0
  },
  category: 'Stablecoin',
  type: 'Automated Yearn Vault',
  kind: 'Multi Strategy',
  v3: true,
  yearn: true,
  isRetired: false,
  isHidden: true,
  isBoosted: false,
  isHighlighted: false,
  inclusion: {
    isYearn: true
  },
  migration: false,
  origin: 'yearn',
  strategiesCount: 0,
  riskLevel: 1,
  staking: null,
  pricePerShare: '1030000'
} as const

describe('buildYvUsdVaultsModel', () => {
  it('builds the combined yvUSD model from Kong snapshots and points booleans', () => {
    const baseVault = buildSyntheticBaseVault(UNLOCKED_SNAPSHOT as any)
    const model = buildYvUsdVaultsModel({
      baseVault,
      unlockedSnapshot: UNLOCKED_SNAPSHOT as any,
      lockedSnapshot: LOCKED_SNAPSHOT as any,
      points: {
        unlocked: true,
        locked: false
      }
    })

    expect(model.assetAddress).toBe(UNDERLYING_ASSET.address)
    expect(model.listVault.tvl.tvl).toBe(1000)
    expect(model.lockedVault.apr.forwardAPR.netAPR).toBe(0.11)
    expect(model.unlockedVault.strategies?.[0].name).toBe('Infinifi sIUSD Morpho Looper')
    expect(model.metrics.unlocked.hasInfinifiPoints).toBe(true)
    expect(model.metrics.locked.hasInfinifiPoints).toBe(false)
  })

  it('prefers the unlocked snapshot asset over a locked-base vault asset when resolving deposits', () => {
    const model = buildYvUsdVaultsModel({
      baseVault: LOCKED_LIST_BASE_VAULT as any,
      unlockedSnapshot: UNLOCKED_SNAPSHOT as any,
      lockedSnapshot: LOCKED_SNAPSHOT as any
    })

    expect(model.assetAddress).toBe(UNDERLYING_ASSET.address)
  })
})

describe('getYvUsdTvlBreakdown', () => {
  it('treats the unlocked vault TVL as total and derives the unlocked remainder after locked TVL', () => {
    expect(getYvUsdTvlBreakdown({ totalTvl: 1000, lockedTvl: 500 })).toEqual({
      totalTvl: 1000,
      unlockedTvl: 500,
      lockedTvl: 500
    })
  })

  it('clamps the unlocked remainder at zero when locked TVL exceeds total TVL', () => {
    expect(getYvUsdTvlBreakdown({ totalTvl: 100, lockedTvl: 120 })).toEqual({
      totalTvl: 100,
      unlockedTvl: 0,
      lockedTvl: 120
    })
  })
})
