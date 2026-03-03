import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { yieldSplitterAbi } from '@pages/vaults/contracts/yieldSplitter.abi'
import type { UseWidgetDepositFlowReturn } from '@pages/vaults/types'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseSplitterDepositParams {
  strategyAddress?: Address
  assetAddress: Address
  amount: bigint
  account?: Address
  enabled: boolean
}

export function useSplitterDeposit(params: UseSplitterDepositParams): UseWidgetDepositFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.assetAddress,
    spender: params.strategyAddress,
    watch: true,
    chainId: KATANA_CHAIN_ID
  })

  const isValidInput = params.amount > 0n && !!params.strategyAddress
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && !!params.account && params.enabled
  const prepareDepositEnabled = isAllowanceSufficient && isValidInput && !!params.account && params.enabled

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: params.assetAddress,
    args: params.strategyAddress && params.amount > 0n ? [params.strategyAddress, params.amount] : undefined,
    chainId: KATANA_CHAIN_ID,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: yieldSplitterAbi,
    functionName: 'deposit',
    address: params.strategyAddress,
    args: params.account ? [params.amount, toAddress(params.account)] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: KATANA_CHAIN_ID,
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
      expectedOut: params.amount, // 1:1 for underlying → splitter
      isLoadingRoute: false,
      isCrossChain: false,
      error: undefined
    }
  }
}
