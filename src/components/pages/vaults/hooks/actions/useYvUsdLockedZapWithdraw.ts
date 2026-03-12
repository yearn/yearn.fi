import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { YVUSD_LOCKED_ADDRESS, YVUSD_LOCKED_ZAP_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { yvUsdLockedZapAbi } from '@shared/contracts/abi/yvUsdLockedZap.abi'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import { erc20Abi, maxUint256 } from 'viem'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseYvUsdLockedZapWithdrawParams {
  amount: bigint
  requiredShares: bigint
  account?: Address
  chainId: number
  enabled: boolean
}

export function useYvUsdLockedZapWithdraw(params: UseYvUsdLockedZapWithdrawParams): UseWidgetWithdrawFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: YVUSD_LOCKED_ADDRESS,
    spender: YVUSD_LOCKED_ZAP_ADDRESS,
    watch: true,
    chainId: params.chainId
  })

  const isAllowanceSufficient = allowance >= params.requiredShares
  const prepareApproveEnabled =
    !!params.account && params.enabled && params.amount > 0n && params.requiredShares > 0n && !isAllowanceSufficient
  const prepareWithdrawEnabled =
    !!params.account && params.enabled && params.amount > 0n && params.requiredShares > 0n && isAllowanceSufficient

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: YVUSD_LOCKED_ADDRESS,
    args: params.requiredShares > 0n ? [YVUSD_LOCKED_ZAP_ADDRESS, params.requiredShares] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareWithdraw: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ZAP_ADDRESS,
    abi: yvUsdLockedZapAbi,
    functionName: 'zapOut',
    args: params.account && params.requiredShares > 0n ? [params.requiredShares, toAddress(params.account)] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareWithdraw
    },
    periphery: {
      prepareApproveEnabled,
      prepareWithdrawEnabled,
      isAllowanceSufficient,
      allowance: isAllowanceSufficient ? maxUint256 : allowance,
      expectedOut: params.amount,
      isLoadingRoute: false,
      isCrossChain: false,
      routerAddress: YVUSD_LOCKED_ZAP_ADDRESS,
      error: undefined
    }
  }
}
