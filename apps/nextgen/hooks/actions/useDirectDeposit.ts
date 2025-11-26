import { toAddress } from '@lib/utils'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import type { UseWidgetDepositFlowReturn } from '@nextgen/types'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useReadContract, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseDirectDepositParams {
  vaultAddress: Address
  assetAddress: Address
  amount: bigint
  account?: Address
  chainId: number
  decimals: number
  enabled: boolean
}

export function useDirectDeposit(params: UseDirectDepositParams): UseWidgetDepositFlowReturn {
  // Check current allowance using shared hook
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.assetAddress,
    spender: params.vaultAddress,
    watch: true,
    chainId: params.chainId
  })

  // Use previewDeposit to get expected shares (standard ERC4626 method)
  const { data: expectedOut = 0n, isError: isPreviewError } = useReadContract({
    address: params.vaultAddress,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [params.amount],
    chainId: params.chainId,
    query: { enabled: params.enabled && params.amount > 0n }
  })

  const isValidInput = params.amount > 0n
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && !!params.account
  const prepareDepositEnabled = isAllowanceSufficient && isValidInput && !!params.account

  // Prepare approve transaction using useSimulateContract
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: params.assetAddress,
    args: params.amount > 0n && params.vaultAddress ? [params.vaultAddress, params.amount] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Prepare deposit transaction using useSimulateContract
  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: vaultAbi,
    functionName: 'deposit',
    address: params.vaultAddress,
    args: [params.amount, toAddress(params.account)],
    account: toAddress(params.account),
    chainId: params.chainId,
    query: { enabled: prepareDepositEnabled }
  })

  const error = isPreviewError ? 'Failed to preview deposit' : undefined

  return {
    actions: {
      prepareApprove,
      prepareDeposit
    },
    periphery: {
      prepareApproveEnabled,
      prepareDepositEnabled,
      isAllowanceSufficient,
      expectedOut,
      isLoadingRoute: false,
      isCrossChain: false,
      error
    }
  }
}
