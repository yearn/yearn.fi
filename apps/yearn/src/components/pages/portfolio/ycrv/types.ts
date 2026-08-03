import type { TPortfolioProtocolPosition } from '@pages/portfolio/types/position'
import type { TAddress } from '@shared/types'

export type TYcrvPosition = TPortfolioProtocolPosition & {
  kind: 'ycrv-staker'
  amountRaw: bigint
  amountNormalized: number
}

export type TYcrvReward = {
  tokenAddress: TAddress
  symbol: 'yvcrvUSD-2'
  amountRaw: bigint
  amountNormalized: number
  usdValue: number
}

export type TYcrvRawAccount = {
  balanceRaw: bigint
  totalSupplyRaw: bigint
  userActiveAprRaw: bigint
  userActiveBoostRaw: bigint
  claimableRewardRaw: bigint
}
