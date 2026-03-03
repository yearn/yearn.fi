import type { Address } from 'viem'

export type TSplitterRoute = {
  vault: Address
  strategy: Address
  want: Address
}

export type TSplitterWantToken = {
  address: Address
  symbol: string
  decimals: number
  name: string
}

export type TSplitterPosition = {
  strategyAddress: Address
  vaultAddress: Address
  wantToken: TSplitterWantToken
  balance: bigint
  balanceUsd: number
  earned: bigint
}

export type TKatanaVaultApr = {
  apr: {
    netAPR: number
    extra: {
      katanaRewardsAPR: number
      steerPointsPerDollar?: number
      katanaBonusAPY: number
      katanaAppRewardsAPR: number
      FixedRateKatanaRewards: number
      extrinsicYield: number
      katanaNativeYield: number
    }
  }
}

export type TKatanaAprs = Record<string, TKatanaVaultApr>
