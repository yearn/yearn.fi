import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { agglayerBridgeAbi } from '@shared/contracts/abi/agglayerBridge.abi'
import { type AppUseSimulateContractReturnType, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address } from 'viem'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseKatanaWithdrawBridgeParams {
  bridgeContractAddress: Address
  katanaAssetToken: Address
  destinationAddress: Address
  amount: bigint
  account?: Address
  chainId: number
  destinationNetworkId: number
  enabled: boolean
}

export function useKatanaWithdrawBridge(params: UseKatanaWithdrawBridgeParams): UseWidgetWithdrawFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.katanaAssetToken,
    spender: params.bridgeContractAddress,
    watch: true,
    chainId: params.chainId,
    enabled: params.enabled
  })

  const isValidInput = params.amount > 0n && !!params.account
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = params.enabled && !isAllowanceSufficient && isValidInput
  const prepareWithdrawEnabled = params.enabled && isAllowanceSufficient && isValidInput

  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(params.katanaAssetToken),
    functionName: 'approve',
    address: params.katanaAssetToken,
    args: [params.bridgeContractAddress, params.amount],
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareWithdraw: AppUseSimulateContractReturnType = useSimulateContract({
    abi: agglayerBridgeAbi,
    functionName: 'bridgeAsset',
    address: params.bridgeContractAddress,
    args: params.account
      ? [params.destinationNetworkId, params.destinationAddress, params.amount, params.katanaAssetToken, false, '0x']
      : undefined,
    account: params.account,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled }
  })

  const error = prepareWithdraw.isError ? 'Unable to prepare bridge' : undefined

  return {
    actions: {
      prepareApprove,
      prepareWithdraw
    },
    periphery: {
      prepareApproveEnabled,
      prepareWithdrawEnabled,
      isAllowanceSufficient,
      allowance,
      expectedOut: params.amount,
      isLoadingRoute: false,
      isCrossChain: true,
      routerAddress: params.bridgeContractAddress,
      error
    }
  }
}
