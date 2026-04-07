import { useSimulateContract } from '@shared/hooks/useAppWagmi'

const YIELD_SPLITTER_CLAIM_ABI = [
  {
    inputs: [],
    name: 'getReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

type UseClaimYieldSplitterRewardsParams = {
  splitterAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

export function useClaimYieldSplitterRewards(params: UseClaimYieldSplitterRewardsParams) {
  const { splitterAddress, chainId, enabled = true } = params

  const prepare = useSimulateContract({
    address: splitterAddress,
    abi: YIELD_SPLITTER_CLAIM_ABI,
    functionName: 'getReward',
    chainId,
    query: { enabled: enabled && !!splitterAddress }
  })

  return { prepare }
}
