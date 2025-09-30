import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { zeroAddress } from 'viem'

export const mockVault: TYDaemonVault = {
  chainID: 1,
  token: {
    symbol: 'USDC',
    address: '0x27B5739e22ad9033bcBf192059122d163b60349D',
    name: 'USDC',
    description: 'USDC',
    decimals: 6
  },
  address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
  version: 'v2',
  type: 'Automated',
  symbol: 'USDC',
  kind: 'Single Strategy',
  name: 'USDC',
  description: 'USDC',
  decimals: 6,
  category: 'Stablecoin',
  tvl: {
    totalAssets: 100000000000n,
    tvl: 100000,
    price: 1
  },
  apr: {
    type: 'Automated',
    points: {
      weekAgo: 1000000000000000000000000,
      monthAgo: 1000000000000000000000000,
      inception: 1000000000000000000000000
    },
    netAPR: 1000000000000000000000000,
    fees: {
      performance: 1000000000000000000000000,
      withdrawal: 1000000000000000000000000,
      management: 1000000000000000000000000
    },
    extra: {
      stakingRewardsAPR: 1000000000000000000000000,
      gammaRewardAPR: 1000000000000000000000000
    },
    pricePerShare: {
      today: 1000000000000000000000000,
      weekAgo: 1000000000000000000000000,
      monthAgo: 1000000000000000000000000
    },
    forwardAPR: {
      type: 'Automated',
      netAPR: 1000000000000000000000000,
      composite: {
        boost: 1000000000000000000000000,
        poolAPY: 1000000000000000000000000,
        boostedAPR: 1000000000000000000000000,
        baseAPR: 1000000000000000000000000,
        cvxAPR: 1000000000000000000000000,
        rewardsAPR: 1000000000000000000000000,
        v3OracleCurrentAPR: 1000000000000000000000000,
        v3OracleStratRatioAPR: 1000000000000000000000000,
        keepCRV: 1000000000000000000000000,
        keepVELO: 1000000000000000000000000,
        cvxKeepCRV: 1000000000000000000000000
      }
    }
  },
  featuringScore: 100,
  info: {
    riskScore: [],
    sourceURL: '',
    riskLevel: 0,
    riskScoreComment: '',
    uiNotice: '',
    isRetired: false,
    isBoosted: false,
    isHighlighted: false
  },
  strategies: [],
  migration: {
    available: false,
    address: zeroAddress,
    contract: zeroAddress
  },
  staking: {
    address: zeroAddress,
    available: false,
    source: '',
    rewards: []
  }
}
