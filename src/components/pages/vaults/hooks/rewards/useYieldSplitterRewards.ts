import type { TStakingReward } from '@pages/vaults/components/widget/rewards/types'
import { useTokens } from '@pages/vaults/hooks/useTokens'
import { useYearn } from '@shared/contexts/useYearn'
import { isZeroAddress, toAddress, toNormalizedValue } from '@shared/utils'
import { useCallback, useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { resolveExecutionChainId } from '@/config/tenderly'

const YIELD_SPLITTER_REWARDS_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_account', type: 'address' },
      { internalType: 'address', name: '_rewardToken', type: 'address' }
    ],
    name: 'earned',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

type UseYieldSplitterRewardsParams = {
  splitterAddress?: `0x${string}`
  rewardTokenAddresses: `0x${string}`[]
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

type UseYieldSplitterRewardsReturn = {
  rewards: TStakingReward[]
  isLoading: boolean
  refetch: () => void
}

export function useYieldSplitterRewards(params: UseYieldSplitterRewardsParams): UseYieldSplitterRewardsReturn {
  const { splitterAddress, rewardTokenAddresses, userAddress, chainId, enabled = true } = params
  const { getPrice } = useYearn()
  const executionChainId = resolveExecutionChainId(chainId)

  const normalizedRewardTokenAddresses = useMemo(
    () =>
      Array.from(
        new Set(rewardTokenAddresses.map((address) => toAddress(address)).filter((address) => !isZeroAddress(address)))
      ) as `0x${string}`[],
    [rewardTokenAddresses]
  )

  const {
    tokens,
    isLoading: isLoadingTokens,
    refetch: refetchTokens
  } = useTokens(normalizedRewardTokenAddresses, chainId, userAddress)

  const tokenMap = useMemo(
    () =>
      tokens.reduce((accumulator, token) => {
        const address = token.address ? toAddress(token.address) : undefined
        if (address) {
          accumulator.set(address, token)
        }
        return accumulator
      }, new Map<string, (typeof tokens)[number]>()),
    [tokens]
  )

  const isEnabled = enabled && !!splitterAddress && !!userAddress && normalizedRewardTokenAddresses.length > 0

  const contracts = useMemo(
    () =>
      isEnabled && !!executionChainId
        ? normalizedRewardTokenAddresses.map((rewardTokenAddress) => ({
            // Intentionally read rewards from the splitter contract itself.
            // In the ysplitter ABI, `earned(account, rewardToken)` lives on YieldSplitter,
            // while `rewardHandlerAddress` points at a helper contract with a different surface.
            address: splitterAddress!,
            abi: YIELD_SPLITTER_REWARDS_ABI,
            functionName: 'earned' as const,
            args: [userAddress!, rewardTokenAddress] as const,
            chainId: executionChainId
          }))
        : [],
    [executionChainId, isEnabled, normalizedRewardTokenAddresses, splitterAddress, userAddress]
  )

  const {
    data: earnedData,
    isLoading: isLoadingEarned,
    refetch: refetchEarned
  } = useReadContracts({
    contracts,
    query: { enabled: isEnabled && !!executionChainId }
  })

  const rewards = useMemo((): TStakingReward[] => {
    if (!isEnabled) {
      return []
    }

    return normalizedRewardTokenAddresses
      .map((rewardTokenAddress, index) => {
        const result = earnedData?.[index]
        const amount = result?.status === 'success' ? (result.result as bigint) : 0n
        const token = tokenMap.get(rewardTokenAddress)
        const decimals = token?.decimals ?? 18
        const price = getPrice({ address: rewardTokenAddress, chainID: chainId }).normalized

        return {
          tokenAddress: rewardTokenAddress,
          symbol: token?.symbol ?? '???',
          decimals,
          amount,
          price,
          usdValue: toNormalizedValue(amount, decimals) * price
        }
      })
      .filter((reward) => reward.amount > 0n)
  }, [chainId, earnedData, getPrice, isEnabled, normalizedRewardTokenAddresses, tokenMap])

  const refetch = useCallback(() => {
    refetchTokens()
    refetchEarned()
  }, [refetchEarned, refetchTokens])

  return {
    rewards,
    isLoading: isLoadingTokens || isLoadingEarned,
    refetch
  }
}
