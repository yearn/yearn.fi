import { TOKENIZED_STRATEGY_ABI } from '@yearn/vault-widget/internal/contracts/abi/tokenizedStrategy.abi'
import { yBoldZapperAbi } from '@yearn/vault-widget/internal/contracts/abi/yBoldZapper.abi'
import {
  type AppUseSimulateContractReturnType,
  useReadContract,
  useSimulateContract
} from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { toAddress } from '@yearn/vault-widget/internal/utils'
import { YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import type { UseWidgetWithdrawFlowReturn } from '@yearn/vault-widget/types'
import { YBOLD_STAKING_ADDRESS } from '@yearn/vault-widget/ybold'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseYBoldZapperWithdrawParams {
  requiredVaultShares: bigint
  redeemAll: boolean
  maxRedeemShares: bigint
  maxLoss: bigint
  optimisticApprovedShares?: bigint | null
  account?: Address
  chainId: number
  enabled: boolean
}

function getEffectiveApprovedShares(allowance: bigint, optimisticApprovedShares?: bigint | null): bigint {
  if (optimisticApprovedShares && optimisticApprovedShares > allowance) {
    return optimisticApprovedShares
  }

  return allowance
}

export function useYBoldZapperWithdraw(params: UseYBoldZapperWithdrawParams): UseWidgetWithdrawFlowReturn {
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: YBOLD_STAKING_ADDRESS,
    spender: YBOLD_ZAPPER_ADDRESS,
    watch: true,
    chainId: params.chainId
  })

  const effectiveApprovedShares = getEffectiveApprovedShares(allowance, params.optimisticApprovedShares)
  const isValidInput = params.requiredVaultShares > 0n
  const {
    data: previewWithdrawSharesData,
    isLoading: isLoadingPreviewWithdraw,
    isFetching: isFetchingPreviewWithdraw
  } = useReadContract({
    address: YBOLD_STAKING_ADDRESS,
    abi: TOKENIZED_STRATEGY_ABI,
    functionName: 'previewWithdraw',
    args: [params.requiredVaultShares],
    chainId: params.chainId,
    query: { enabled: params.enabled && isValidInput && !params.redeemAll }
  })
  const zapperShares =
    params.redeemAll && params.maxRedeemShares > 0n ? params.maxRedeemShares : (previewWithdrawSharesData ?? 0n)
  const hasZapperShares = zapperShares > 0n
  const isAllowanceSufficient = effectiveApprovedShares >= zapperShares
  const prepareApproveEnabled =
    !!params.account && params.enabled && isValidInput && hasZapperShares && !isAllowanceSufficient
  const prepareWithdrawEnabled =
    !!params.account && params.enabled && isValidInput && hasZapperShares && isAllowanceSufficient

  const {
    data: expectedOut = 0n,
    isLoading: isLoadingPreviewRedeem,
    isFetching: isFetchingPreviewRedeem
  } = useReadContract({
    address: YBOLD_ZAPPER_ADDRESS,
    abi: yBoldZapperAbi,
    functionName: 'previewRedeem',
    args: [zapperShares],
    chainId: params.chainId,
    query: { enabled: params.enabled && hasZapperShares }
  })

  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: YBOLD_STAKING_ADDRESS,
    args: hasZapperShares ? [YBOLD_ZAPPER_ADDRESS, zapperShares] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareWithdraw: AppUseSimulateContractReturnType = useSimulateContract({
    address: YBOLD_ZAPPER_ADDRESS,
    abi: yBoldZapperAbi,
    functionName: 'zapOut',
    args: params.account && hasZapperShares ? [zapperShares, toAddress(params.account), params.maxLoss] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled }
  })
  const isLoadingRoute =
    isLoadingPreviewWithdraw || isFetchingPreviewWithdraw || isLoadingPreviewRedeem || isFetchingPreviewRedeem

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
      shareAmount: zapperShares,
      expectedOut,
      minExpectedOut: expectedOut,
      isLoadingRoute,
      isCrossChain: false,
      routerAddress: YBOLD_ZAPPER_ADDRESS,
      error: undefined
    }
  }
}
