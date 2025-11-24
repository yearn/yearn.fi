import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import {
  applyFeaturingScores,
  clampValue,
  computeFeaturingScore,
  FEATURE_APR_CAP,
  FEATURE_HIGHLIGHT_MULTIPLIER,
  FEATURE_TVL_CAP,
  type TFeaturingOverride
} from './computeFeaturingScore'

const makeVault = (overrides?: Partial<TYDaemonVault>): TYDaemonVault => ({
  address: '0xbase',
  version: 'v1',
  type: 'Standard',
  kind: 'Legacy',
  symbol: 'SYM',
  name: 'Vault',
  description: '',
  category: 'Stablecoin',
  decimals: 18,
  chainID: 1,
  token: {
    address: '0xtoken',
    name: 'Token',
    symbol: 'TKN',
    description: '',
    decimals: 18
  },
  tvl: {
    totalAssets: 0n,
    tvl: 1_000_000,
    price: 1
  },
  apr: {
    type: 'net',
    netAPR: 0.1,
    fees: { performance: 0, withdrawal: 0, management: 0 },
    extra: { stakingRewardsAPR: 0, gammaRewardAPR: 0 },
    points: { weekAgo: 0, monthAgo: 0, inception: 0 },
    pricePerShare: { today: 0, weekAgo: 0, monthAgo: 0 },
    forwardAPR: {
      type: 'unknown',
      netAPR: 0,
      composite: {
        boost: 0,
        poolAPY: 0,
        boostedAPR: 0,
        baseAPR: 0,
        cvxAPR: 0,
        rewardsAPR: 0,
        v3OracleCurrentAPR: 0,
        v3OracleStratRatioAPR: 0,
        keepCRV: 0,
        keepVELO: 0,
        cvxKeepCRV: 0
      }
    }
  },
  featuringScore: 0,
  strategies: [],
  staking: {
    address: '0x0',
    available: false,
    source: '',
    rewards: []
  },
  migration: {
    available: false,
    address: '0x0',
    contract: '0x0'
  },
  info: {
    sourceURL: '',
    riskLevel: -1,
    riskScore: [],
    riskScoreComment: '',
    uiNotice: '',
    isRetired: false,
    isBoosted: false,
    isHighlighted: false,
    isHidden: false
  },
  ...overrides
})

describe('clampValue', () => {
  it('clamps negatives and non-finite to 0', () => {
    expect(clampValue(-1, 10)).toBe(0)
    expect(clampValue(Number.NaN, 10)).toBe(0)
    expect(clampValue(Number.POSITIVE_INFINITY, 10)).toBe(0)
  })

  it('caps to provided limit', () => {
    expect(clampValue(20, 10)).toBe(10)
    expect(clampValue(5, 10)).toBe(5)
  })
})

describe('computeFeaturingScore', () => {
  it('computes base score tvl * apr', () => {
    const vault = makeVault({
      tvl: { totalAssets: 0n, tvl: 100, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.5 }
    })
    expect(computeFeaturingScore({ baseVault: vault })).toBe(50)
  })

  it('applies highlight multiplier when highlighted', () => {
    const vault = makeVault({
      tvl: { totalAssets: 0n, tvl: 2, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.5 },
      info: { ...makeVault().info, isHighlighted: true }
    })
    expect(computeFeaturingScore({ baseVault: vault })).toBe(2 * 0.5 * FEATURE_HIGHLIGHT_MULTIPLIER)
  })

  it('uses override APR and TVL when provided', () => {
    const baseVault = makeVault({
      tvl: { totalAssets: 0n, tvl: 10, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.1 }
    })
    const overrideVault = makeVault({
      address: '0xoverride',
      tvl: { totalAssets: 0n, tvl: 30, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.2 }
    })
    const score = computeFeaturingScore({
      baseVault,
      overrideVault,
      override: { address: '0xoverride', useAprFrom: 'override', useTvlFrom: 'override', useHighlightFrom: 'base' }
    })
    expect(score).toBe(30 * 0.2)
  })

  it('clamps APR and TVL to caps', () => {
    const baseVault = makeVault({
      tvl: { totalAssets: 0n, tvl: FEATURE_TVL_CAP * 10, price: 1 },
      apr: { ...makeVault().apr, netAPR: FEATURE_APR_CAP * 10 }
    })
    const score = computeFeaturingScore({ baseVault })
    expect(score).toBe(FEATURE_TVL_CAP * FEATURE_APR_CAP)
  })
})

describe('applyFeaturingScores', () => {
  it('applies override when present; warns on missing override target and falls back', () => {
    const warn = vi.fn()
    const baseAddress = '0xbase' as Address
    const missingAddress = '0xmissing' as Address
    const base = makeVault({
      address: baseAddress,
      tvl: { totalAssets: 0n, tvl: 10, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.1 }
    })
    const vaults = { [baseAddress]: base }
    const overrides: Record<Address, TFeaturingOverride> = {
      [baseAddress]: {
        address: missingAddress,
        useAprFrom: 'override',
        useTvlFrom: 'override',
        useHighlightFrom: 'base'
      }
    }
    const result = applyFeaturingScores(vaults, overrides, { warn })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(result['0xbase'].featuringScore).toBe(base.tvl.tvl * base.apr.netAPR)
  })

  it('computes scores for all vaults with override mapping', () => {
    const baseAddress = '0xbase' as Address
    const overrideAddress = '0xoverride' as Address
    const base = makeVault({
      address: baseAddress,
      tvl: { totalAssets: 0n, tvl: 10, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.1 }
    })
    const override = makeVault({
      address: overrideAddress,
      tvl: { totalAssets: 0n, tvl: 20, price: 1 },
      apr: { ...makeVault().apr, netAPR: 0.2 }
    })
    const vaults = { [baseAddress]: base, [overrideAddress]: override }
    const overrides: Record<Address, TFeaturingOverride> = {
      [baseAddress]: {
        address: overrideAddress,
        useAprFrom: 'override',
        useTvlFrom: 'override',
        useHighlightFrom: 'base'
      }
    }
    const result = applyFeaturingScores(vaults, overrides)
    expect(result['0xbase'].featuringScore).toBe(20 * 0.2)
    expect(result['0xoverride'].featuringScore).toBe(20 * 0.2)
  })
})
