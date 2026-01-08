import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import { useEffect, useMemo } from 'react'
import type { Address } from 'viem'
import { useSolverEnso } from '../solvers/useSolverEnso'
import { useEnsoOrder } from '../useEnsoOrder'

interface UseEnsoWithdrawParams {
  vaultAddress: Address
  withdrawToken: Address
  amount: bigint
  currentAmount?: bigint // Raw undebounced amount for reset triggering
  account?: Address
  receiver?: Address
  chainId: number
  destinationChainId?: number
  decimalsOut: number
  enabled: boolean
  slippage?: number
}

export function useEnsoWithdraw(params: UseEnsoWithdrawParams): UseWidgetWithdrawFlowReturn {
  // Get Enso routing flow
  const ensoFlow = useSolverEnso({
    tokenIn: params.vaultAddress,
    tokenOut: params.withdrawToken,
    amountIn: params.amount,
    fromAddress: params.account,
    receiver: params.receiver,
    chainId: params.chainId,
    destinationChainId: params.destinationChainId,
    decimalsOut: params.decimalsOut,
    slippage: params.slippage,
    enabled: params.enabled
  })

  // Calculate if allowance is sufficient
  const isAllowanceSufficient = !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset route when raw amount changes to prevent stale error display
  useEffect(() => {
    ensoFlow.methods.resetRoute()
  }, [params.currentAmount])

  // Fetch route when debounced amount changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Infinite loop
  useEffect(() => {
    if (params.amount > 0n && params.enabled) {
      ensoFlow.methods.getRoute()
    }
  }, [params.amount, params.enabled])

  // Prepare Enso order for withdrawal
  const canWithdraw = ensoFlow.periphery.route && params.amount > 0n && isAllowanceSufficient
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction: ensoFlow.methods.getEnsoTransaction,
    enabled: canWithdraw,
    chainId: params.chainId
  })

  // Adapt ensoFlow to UseWidgetWithdrawFlowReturn interface
  return useMemo(
    (): UseWidgetWithdrawFlowReturn => ({
      actions: {
        prepareApprove: ensoFlow.actions.prepareApprove,
        prepareWithdraw: prepareEnsoOrder
      },
      periphery: {
        prepareApproveEnabled: ensoFlow.periphery.prepareApproveEnabled,
        prepareWithdrawEnabled: !!canWithdraw && !ensoFlow.periphery.isLoadingRoute,
        isAllowanceSufficient,
        expectedOut: ensoFlow.periphery.expectedOut.raw,
        isLoadingRoute: ensoFlow.periphery.isLoadingRoute,
        isCrossChain: ensoFlow.periphery.isCrossChain,
        routerAddress: ensoFlow.periphery.routerAddress,
        error: ensoFlow.periphery.error?.message,
        resetQuote: ensoFlow.methods.resetRoute
      }
    }),
    [ensoFlow, prepareEnsoOrder, canWithdraw, isAllowanceSufficient]
  )
}
