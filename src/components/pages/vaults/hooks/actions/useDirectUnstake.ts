import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { type AppUseSimulateContractReturnType, useSimulateContract } from '@shared/hooks/useAppWagmi'
import type { Address } from 'viem'
import { maxUint256 } from 'viem'
import { getDirectUnstakeCalls } from './stakingAdapter'

interface UseDirectUnstakeParams {
  stakingAddress?: Address
  amount: bigint // vault token amount to unstake
  redeemAll?: boolean
  maxRedeemShares?: bigint
  account?: Address
  chainId: number
  stakingSource?: string
  enabled: boolean
}

export function useDirectUnstake(params: UseDirectUnstakeParams): UseWidgetWithdrawFlowReturn {
  const isValidInput = params.amount > 0n && !!params.stakingAddress
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled

  const unstakeCalls = getDirectUnstakeCalls({
    stakingSource: params.stakingSource,
    amount: params.amount,
    account: params.account,
    redeemAll: params.redeemAll,
    maxRedeemShares: params.maxRedeemShares
  })

  const preparePrimaryWithdraw: AppUseSimulateContractReturnType = useSimulateContract({
    abi: unstakeCalls.primary.abi as any,
    functionName: unstakeCalls.primary.functionName as any,
    address: params.stakingAddress,
    args: unstakeCalls.primary.args as any,
    chainId: params.chainId,
    account: params.account,
    query: { enabled: prepareWithdrawEnabled }
  })

  const shouldTryFallback =
    prepareWithdrawEnabled && !!unstakeCalls.fallback && !!params.stakingAddress && preparePrimaryWithdraw.isError

  const prepareFallbackWithdraw: AppUseSimulateContractReturnType = useSimulateContract({
    abi: (unstakeCalls.fallback?.abi || []) as any,
    functionName: (unstakeCalls.fallback?.functionName || 'withdraw') as any,
    address: params.stakingAddress,
    args: unstakeCalls.fallback?.args as any,
    chainId: params.chainId,
    account: params.account,
    query: { enabled: shouldTryFallback }
  })

  const prepareWithdraw: AppUseSimulateContractReturnType =
    unstakeCalls.fallback && preparePrimaryWithdraw.isError ? prepareFallbackWithdraw : preparePrimaryWithdraw

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareApproveEnabled: false, // No approval needed for unstaking own shares
      prepareWithdrawEnabled,
      isAllowanceSufficient: true, // No approval needed for unstaking own shares
      allowance: maxUint256, // No approval needed - unlimited
      expectedOut: params.amount, // User gets the vault tokens they unstake
      minExpectedOut: params.amount,
      isLoadingRoute: false, // No routing needed for direct unstake
      isCrossChain: false, // Direct unstake is always same-chain
      error: undefined
    }
  }
}
