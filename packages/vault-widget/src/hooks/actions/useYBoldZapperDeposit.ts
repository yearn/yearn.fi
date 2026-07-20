import { yBoldZapperAbi } from '@yearn/vault-widget/internal/contracts/abi/yBoldZapper.abi'
import {
  type AppUseSimulateContractReturnType,
  useReadContract,
  useSimulateContract
} from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { toAddress } from '@yearn/vault-widget/internal/utils'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { BOLD_ADDRESS, YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import type { UseWidgetDepositFlowReturn } from '@yearn/vault-widget/types'
import type { Address } from 'viem'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseYBoldZapperDepositParams {
  amount: bigint
  account?: Address
  chainId: number
  enabled: boolean
}

export function useYBoldZapperDeposit(params: UseYBoldZapperDepositParams): UseWidgetDepositFlowReturn {
  const { allowance = 0n, refetch: refetchAllowance } = useTokenAllowance({
    account: params.account,
    token: BOLD_ADDRESS,
    spender: YBOLD_ZAPPER_ADDRESS,
    watch: true,
    chainId: params.chainId
  })

  const isValidInput = params.amount > 0n
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !!params.account && params.enabled && isValidInput && !isAllowanceSufficient
  const prepareDepositEnabled = !!params.account && params.enabled && isValidInput && isAllowanceSufficient

  const { data: expectedOut = 0n } = useReadContract({
    address: YBOLD_ZAPPER_ADDRESS,
    abi: yBoldZapperAbi,
    functionName: 'previewDeposit',
    args: [params.amount],
    chainId: params.chainId,
    query: { enabled: params.enabled && isValidInput }
  })

  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(BOLD_ADDRESS),
    functionName: 'approve',
    address: BOLD_ADDRESS,
    args: params.amount > 0n ? [YBOLD_ZAPPER_ADDRESS, params.amount] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: AppUseSimulateContractReturnType = useSimulateContract({
    address: YBOLD_ZAPPER_ADDRESS,
    abi: yBoldZapperAbi,
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
      minExpectedOut: expectedOut,
      isLoadingRoute: false,
      isCrossChain: false,
      routerAddress: YBOLD_ZAPPER_ADDRESS,
      error: undefined,
      refetchAllowance
    }
  }
}
