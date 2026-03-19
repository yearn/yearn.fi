import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { yieldSplitterAbi } from '@pages/vaults/contracts/yieldSplitter.abi'
import { useSimulateContract } from 'wagmi'

type UseClaimSplitterRewardsParams = {
  strategyAddress?: `0x${string}`
  enabled?: boolean
}

export function useClaimSplitterRewards(params: UseClaimSplitterRewardsParams) {
  const { strategyAddress, enabled = true } = params

  const prepare = useSimulateContract({
    address: strategyAddress,
    abi: yieldSplitterAbi,
    functionName: 'getReward',
    chainId: KATANA_CHAIN_ID,
    query: { enabled: enabled && !!strategyAddress }
  })

  return { prepare }
}
