import { STYFI_ADDRESS, STYFIX_ADDRESS, YVUSDC_REWARD_ADDRESS } from '@pages/portfolio/governance/constants'
import type { TGovernanceGlobalData, TGovernanceRawAccount } from '@pages/portfolio/governance/types'
import { toAddress } from '@shared/utils'
import { describe, expect, it } from 'vitest'
import {
  deriveCooldownEndsAt,
  deriveGovernancePositions,
  getLlyfiYfiEquivalentRaw,
  ONE
} from './deriveGovernancePositions'

const ACCOUNT_TOKEN = toAddress('0x0000000000000000000000000000000000000001')
const YFI_PRICE = 10_000

const emptyRawAccount = (): TGovernanceRawAccount => ({
  styfi: {
    styfiActive: 0n,
    styfiStream: [0n, 0n, 0n],
    styfiWithdrawable: 0n,
    styfixActive: 0n,
    styfixStream: [0n, 0n, 0n],
    styfixWithdrawable: 0n,
    reward: null
  },
  veyfi: {
    legacyBalance: 0n,
    lockedAmount: 0n,
    migrated: false,
    migrationEligible: false,
    unlockTime: 0,
    boostEpochs: null,
    reward: null
  },
  liquidLockers: [
    {
      id: 'sdYFI',
      index: 0,
      name: 'StakeDAO',
      symbol: 'sdYFI',
      tokenAddress: ACCOUNT_TOKEN,
      scale: 1n,
      walletBalance: 0n,
      stakedShares: 0n,
      stream: [0n, 0n, 0n],
      withdrawable: 0n
    },
    {
      id: 'upYFI',
      index: 1,
      name: '1UP',
      symbol: 'upYFI',
      tokenAddress: ACCOUNT_TOKEN,
      scale: 69420n,
      walletBalance: 0n,
      stakedShares: 0n,
      stream: [0n, 0n, 0n],
      withdrawable: 0n
    },
    {
      id: 'coveYFI',
      index: 2,
      name: 'Cove',
      symbol: 'coveYFI',
      tokenAddress: ACCOUNT_TOKEN,
      scale: 1n,
      walletBalance: 0n,
      stakedShares: 0n,
      stream: [0n, 0n, 0n],
      withdrawable: 0n
    }
  ]
})

const globalData: TGovernanceGlobalData = {
  meta: { epoch: 20, timestamp: 1_800_000_000 },
  global: {
    maxBoostBps: 20_000,
    yfi: { totalSupply: String(40_000n * ONE), priceCts: '1000000' },
    veyfi: {
      lockedYfi: String(25n * ONE),
      migratedYfi: String(12n * ONE),
      totalLlyfiStakedBps: 0,
      inventory: { availableYfi: '0', feeBps: 0 },
      tokens: [
        { symbol: 'sdYFI', redemption: { enabled: true, capacity: String(100n * ONE), used: '0', inventory: '0' } },
        { symbol: 'upYFI', redemption: { enabled: true, capacity: String(100n * ONE), used: '0', inventory: '0' } },
        { symbol: 'coveYFI', redemption: { enabled: true, capacity: String(100n * ONE), used: '0', inventory: '0' } }
      ]
    }
  },
  styfi: {
    staked: String(100n * ONE),
    unstaking: String(5n * ONE),
    current: { aprBps: 800 },
    projected: { aprBps: 900 }
  },
  styfix: {
    staked: String(50n * ONE),
    unstaking: String(2n * ONE),
    current: { aprBps: 650 },
    projected: { aprBps: 700 }
  },
  llyfi: [
    {
      symbol: 'sdYFI',
      staked: String(30n * ONE),
      unstaking: 0n.toString(),
      current: { aprBps: 300 },
      projected: { aprBps: 400 }
    },
    {
      symbol: 'upYFI',
      staked: String(20n * ONE),
      unstaking: String(1n * ONE),
      current: { aprBps: 500 },
      projected: { aprBps: 600 }
    },
    {
      symbol: 'coveYFI',
      staked: String(10n * ONE),
      unstaking: 0n.toString(),
      current: { aprBps: 700 },
      projected: { aprBps: 800 }
    }
  ]
}

const getRewardPrice = (): number => 1.25

describe('deriveCooldownEndsAt', () => {
  it('derives the remaining linear cooldown duration from claimed and withdrawable amounts', () => {
    expect(
      deriveCooldownEndsAt({
        total: 100n,
        claimed: 25n,
        withdrawable: 25n,
        durationSeconds: 1000,
        nowSeconds: 10
      })
    ).toBe(510)
  })
})

describe('getLlyfiYfiEquivalentRaw', () => {
  it('converts scaled 1UP balances into YFI-equivalent raw amount', () => {
    expect(getLlyfiYfiEquivalentRaw(69_420n * ONE, 69_420n)).toBe(ONE)
  })

  it('falls back to the raw amount when scale is zero', () => {
    expect(getLlyfiYfiEquivalentRaw(5n * ONE, 0n)).toBe(5n * ONE)
  })
})

describe('deriveGovernancePositions', () => {
  it('derives stYFI and stYFIx positions with shared reward fallback', () => {
    const raw = emptyRawAccount()
    raw.styfi = {
      styfiActive: 2n * ONE,
      styfiStream: [0n, 1n * ONE, 0n],
      styfiWithdrawable: 1n * ONE,
      styfixActive: 3n * ONE,
      styfixStream: [0n, 0n, 0n],
      styfixWithdrawable: 0n,
      reward: {
        amountRaw: 4n * ONE,
        tokenAddress: YVUSDC_REWARD_ADDRESS,
        tokenSymbol: 'yvUSDC',
        tokenDecimals: 18
      }
    }

    const positions = deriveGovernancePositions({
      raw,
      globalData,
      yfiPrice: YFI_PRICE,
      getRewardPrice,
      nowSeconds: 1_000
    })

    expect(positions.map((position) => position.id)).toEqual(['governance-styfi', 'governance-styfix'])
    expect(positions[0]).toMatchObject({
      tokenAddress: STYFI_ADDRESS,
      amountYfiNormalized: 4,
      valueUsd: 40_000,
      tvlYfiNormalized: 105,
      tvlUsd: 1_050_000,
      apy: 0.08
    })
    expect(positions[0]?.reward?.usdValue).toBe(5)
    expect(positions[1]).toMatchObject({
      tokenAddress: STYFIX_ADDRESS,
      amountYfiNormalized: 3,
      valueUsd: 30_000,
      tvlYfiNormalized: 52,
      tvlUsd: 520_000,
      apy: 0.065,
      reward: null
    })
  })

  it('uses projected APR during epoch zero', () => {
    const raw = emptyRawAccount()
    raw.styfi = { ...raw.styfi, styfiActive: ONE, styfixActive: ONE }
    const epochZeroGlobalData = {
      ...globalData,
      meta: { ...globalData.meta, epoch: 0 }
    }

    const positions = deriveGovernancePositions({
      raw,
      globalData: epochZeroGlobalData,
      yfiPrice: YFI_PRICE,
      getRewardPrice
    })

    expect(positions.map((position) => position.apy)).toEqual([0.09, 0.07])
  })

  it('derives migrated veYFI lock state and boost multiplier', () => {
    const raw = emptyRawAccount()
    raw.veyfi = {
      legacyBalance: 9n * ONE,
      lockedAmount: 9n * ONE,
      migrated: true,
      migrationEligible: false,
      unlockTime: 1_900_000_000,
      boostEpochs: 72,
      reward: null
    }

    const positions = deriveGovernancePositions({
      raw,
      globalData,
      yfiPrice: YFI_PRICE,
      getRewardPrice
    })

    expect(positions).toHaveLength(1)
    expect(positions[0]).toMatchObject({
      id: 'governance-veyfi',
      amountYfiNormalized: 9,
      unlockTime: 1_900_000_000,
      tvlYfiNormalized: 12,
      tvlUsd: 120_000,
      boostMultiplier: 1.5
    })
    expect(positions[0]?.apy).toBeCloseTo(0.00675)
  })

  it('derives liquid locker wallet, staked, cooldown, withdrawable, scale, and rewards', () => {
    const raw = emptyRawAccount()
    raw.liquidLockers[1] = {
      ...raw.liquidLockers[1],
      walletBalance: 69_420n * ONE,
      stakedShares: 2n * ONE,
      stream: [0n, 3n * ONE, 1n * ONE],
      withdrawable: 69_420n * ONE,
      reward: {
        amountRaw: 2n * ONE,
        tokenAddress: YVUSDC_REWARD_ADDRESS,
        tokenSymbol: 'yvUSDC',
        tokenDecimals: 18
      }
    }

    const positions = deriveGovernancePositions({
      raw,
      globalData,
      yfiPrice: YFI_PRICE,
      getRewardPrice,
      nowSeconds: 1_000
    })

    expect(positions).toHaveLength(1)
    expect(positions[0]).toMatchObject({
      id: 'governance-llyfi-upyfi',
      name: '1UP YFI',
      amountYfiNormalized: 6,
      valueUsd: 60_000,
      tvlYfiNormalized: 21,
      tvlUsd: 210_000,
      apy: 0.05
    })
    expect(positions[0]?.walletRaw).toBe(69_420n * ONE)
    expect(positions[0]?.activeRaw).toBe(138_840n * ONE)
    expect(positions[0]?.cooldownRaw).toBe(138_840n * ONE)
    expect(positions[0]?.withdrawableRaw).toBe(69_420n * ONE)
    expect(positions[0]?.reward?.usdValue).toBe(2.5)
  })

  it('omits empty and unreadable reward positions', () => {
    const raw = emptyRawAccount()
    raw.styfi = {
      ...raw.styfi,
      styfixActive: 1n * ONE,
      reward: {
        amountRaw: 0n,
        tokenAddress: YVUSDC_REWARD_ADDRESS,
        tokenSymbol: 'yvUSDC',
        tokenDecimals: 18
      }
    }

    const positions = deriveGovernancePositions({
      raw,
      globalData: null,
      yfiPrice: YFI_PRICE,
      getRewardPrice
    })

    expect(positions).toHaveLength(1)
    expect(positions[0]?.id).toBe('governance-styfix')
    expect(positions[0]?.apy).toBeNull()
    expect(positions[0]?.reward).toBeNull()
  })
})
