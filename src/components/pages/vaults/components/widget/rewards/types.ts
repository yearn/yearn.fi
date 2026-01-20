export type TStakingReward = {
  tokenAddress: `0x${string}`
  symbol: string
  decimals: number
  amount: bigint
  price: number
  usdValue: number
}

export type TMerkleReward = {
  token: {
    address: `0x${string}`
    symbol: string
    decimals: number
    price: number
  }
  accumulated: bigint
  unclaimed: bigint
  usdValue: number
  proofs: `0x${string}`[]
}
