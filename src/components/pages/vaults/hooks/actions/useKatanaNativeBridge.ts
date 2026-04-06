import type { UseWidgetDepositFlowReturn } from '@pages/vaults/types'
import { vaultBridgeTokenAbi } from '@shared/contracts/abi/vaultBridgeToken.abi'
import { type AppUseSimulateContractReturnType, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address } from 'viem'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseKatanaNativeBridgeParams {
  bridgeContractAddress: Address
  depositToken: Address
  amount: bigint
  account?: Address
  chainId: number
  destinationNetworkId: number
  enabled: boolean
}

export function useKatanaNativeBridge(params: UseKatanaNativeBridgeParams): UseWidgetDepositFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.depositToken,
    spender: params.bridgeContractAddress,
    watch: true,
    chainId: params.chainId,
    enabled: params.enabled
  })

  const isValidInput = params.amount > 0n && !!params.account
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = params.enabled && !isAllowanceSufficient && isValidInput
  const prepareDepositEnabled = params.enabled && isAllowanceSufficient && isValidInput

  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(params.depositToken),
    functionName: 'approve',
    address: params.depositToken,
    args: [params.bridgeContractAddress, params.amount],
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: AppUseSimulateContractReturnType = useSimulateContract({
    abi: vaultBridgeTokenAbi,
    functionName: 'depositAndBridge',
    address: params.bridgeContractAddress,
    args: params.account ? [params.amount, params.account, params.destinationNetworkId, false] : undefined,
    account: params.account,
    chainId: params.chainId,
    query: { enabled: prepareDepositEnabled }
  })

  const error = prepareDeposit.isError ? 'Unable to prepare bridge' : undefined

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
      expectedOut: params.amount,
      isLoadingRoute: false,
      isCrossChain: true,
      routerAddress: params.bridgeContractAddress,
      error
    }
  }
}
