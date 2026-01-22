export type TStakingReward = {
  tokenAddress: `0x${string}`
  symbol: string
  decimals: number
  amount: bigint
  price: number
  usdValue: number
}

export type TRewardToken = {
  address: `0x${string}`
  symbol: string
  decimals: number
  price: number
}

export type TMerkleReward = {
  token: TRewardToken
  accumulated: bigint
  unclaimed: bigint
  usdValue: number
  proofs: `0x${string}`[]
}

export type TGroupedMerkleReward = {
  token: TRewardToken
  totalUnclaimed: bigint
  totalUsdValue: number
  rewards: TMerkleReward[]
}
