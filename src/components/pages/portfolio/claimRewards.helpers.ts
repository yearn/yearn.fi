import type { TGroupedMerkleReward } from '@pages/vaults/components/widget/rewards/types'

type TChainMerkleData = Record<
  number,
  {
    rewards: TGroupedMerkleReward[]
    isLoading: boolean
    refetch: () => void
  }
>

function merkleRewardsEqual(a: TGroupedMerkleReward[], b: TGroupedMerkleReward[]): boolean {
  if (a.length !== b.length) return false
  return a.every((reward, index) => {
    const other = b[index]
    return reward.token.address === other?.token.address && reward.totalUnclaimed === other?.totalUnclaimed
  })
}

export function mergeChainMerkleData(
  prev: TChainMerkleData,
  chainId: number,
  rewards: TGroupedMerkleReward[],
  isLoading: boolean,
  refetch: () => void
): TChainMerkleData {
  const existing = prev[chainId]

  if (existing?.isLoading === isLoading && merkleRewardsEqual(existing.rewards, rewards)) {
    return prev
  }

  return { ...prev, [chainId]: { rewards, isLoading, refetch } }
}
