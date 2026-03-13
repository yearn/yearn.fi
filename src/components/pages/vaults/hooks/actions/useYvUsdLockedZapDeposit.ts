import type { UseWidgetDepositFlowReturn } from '@pages/vaults/types'
import { YVUSD_LOCKED_ZAP_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { yvUsdLockedZapAbi } from '@shared/contracts/abi/yvUsdLockedZap.abi'
import { toAddress } from '@shared/utils'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address } from 'viem'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useReadContract, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseYvUsdLockedZapDepositParams {
  depositToken: Address
  amount: bigint
  account?: Address
  chainId: number
  enabled: boolean
}

export function useYvUsdLockedZapDeposit(params: UseYvUsdLockedZapDepositParams): UseWidgetDepositFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.depositToken,
    spender: YVUSD_LOCKED_ZAP_ADDRESS,
    watch: true,
    chainId: params.chainId
  })

  const isValidInput = params.amount > 0n
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !!params.account && params.enabled && isValidInput && !isAllowanceSufficient
  const prepareDepositEnabled = !!params.account && params.enabled && isValidInput && isAllowanceSufficient

  const { data: expectedOut = 0n } = useReadContract({
    address: YVUSD_LOCKED_ZAP_ADDRESS,
    abi: yvUsdLockedZapAbi,
    functionName: 'previewZapIn',
    args: [params.amount],
    chainId: params.chainId,
    query: { enabled: params.enabled && isValidInput }
  })

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(params.depositToken),
    functionName: 'approve',
    address: params.depositToken,
    args: params.amount > 0n ? [YVUSD_LOCKED_ZAP_ADDRESS, params.amount] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ZAP_ADDRESS,
    abi: yvUsdLockedZapAbi,
    functionName: 'zapIn',
    args: params.account && params.amount > 0n ? [params.amount, toAddress(params.account)] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: params.chainId,
    query: { enabled: prepareDepositEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareDeposit
    },
    periphery: {
      prepareApproveEnabled,
      prepareDepositEnabled,
      isAllowanceSufficient,
      allowance,
      expectedOut,
      isLoadingRoute: false,
      isCrossChain: false,
      routerAddress: YVUSD_LOCKED_ZAP_ADDRESS,
      error: undefined
    }
  }
}
