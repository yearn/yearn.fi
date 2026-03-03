import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { yieldSplitterAbi } from '@pages/vaults/contracts/yieldSplitter.abi'
import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import { maxUint256 } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface UseSplitterWithdrawParams {
  strategyAddress?: Address
  amount: bigint
  isMaxWithdraw: boolean
  account?: Address
  enabled: boolean
}

export function useSplitterWithdraw(params: UseSplitterWithdrawParams): UseWidgetWithdrawFlowReturn {
  const isValidInput = params.amount > 0n && !!params.strategyAddress
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled

  // Full exit — withdraws everything and claims rewards
  const prepareExit: UseSimulateContractReturnType = useSimulateContract({
    abi: yieldSplitterAbi,
    functionName: 'exit',
    address: params.strategyAddress,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: KATANA_CHAIN_ID,
    query: { enabled: prepareWithdrawEnabled && params.isMaxWithdraw }
  })

  // Partial withdraw
  const preparePartialWithdraw: UseSimulateContractReturnType = useSimulateContract({
    abi: yieldSplitterAbi,
    functionName: 'withdraw',
    address: params.strategyAddress,
    args: params.account ? [params.amount, toAddress(params.account), toAddress(params.account), 0n] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: KATANA_CHAIN_ID,
    query: { enabled: prepareWithdrawEnabled && !params.isMaxWithdraw }
  })

  const prepareWithdraw = params.isMaxWithdraw ? prepareExit : preparePartialWithdraw

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareWithdrawEnabled,
      isAllowanceSufficient: true, // No approval needed for withdrawing own shares
      allowance: maxUint256,
      expectedOut: params.amount,
      isLoadingRoute: false,
      isCrossChain: false,
      error: undefined
    }
  }
}
