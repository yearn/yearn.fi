import { gaugeV2Abi } from '@lib/utils/abi/gaugeV2.abi'
import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface UseDirectUnstakeParams {
  stakingAddress?: Address
  amount: bigint // vault token amount to unstake
  account?: Address
  chainId: number
  enabled: boolean
}

export function useDirectUnstake(params: UseDirectUnstakeParams): UseWidgetWithdrawFlowReturn {
  const isValidInput = params.amount > 0n && !!params.stakingAddress
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled

  // Prepare unstake transaction using gauge withdraw function
  // withdraw(amount, receiver, owner) - no approval needed when owner == msg.sender
  const prepareWithdraw: UseSimulateContractReturnType = useSimulateContract({
    abi: gaugeV2Abi,
    functionName: 'withdraw',
    address: params.stakingAddress,
    args: params.stakingAddress && params.account ? [params.amount, params.account, params.account] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled }
  })

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareWithdrawEnabled,
      isAllowanceSufficient: true, // No approval needed for unstaking own shares
      expectedOut: params.amount, // User gets the vault tokens they unstake
      isLoadingRoute: false, // No routing needed for direct unstake
      isCrossChain: false, // Direct unstake is always same-chain
      error: undefined
    }
  }
}
