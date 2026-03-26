import type { UseWidgetDepositFlowReturn } from '@pages/vaults/types'
import { useEffect, useMemo } from 'react'
import type { Address } from 'viem'
import { useSolverEnso } from '../solvers/useSolverEnso'
import { useEnsoOrder } from '../useEnsoOrder'

interface UseEnsoDepositParams {
  vaultAddress: Address
  depositToken: Address
  amount: bigint
  currentAmount?: bigint // Raw undebounced amount for reset triggering
  account?: Address
  chainId: number
  destinationChainId?: number
  decimalsOut: number
  enabled: boolean
  slippage?: number
}

export function useEnsoDeposit(params: UseEnsoDepositParams): UseWidgetDepositFlowReturn {
  // Get Enso routing flow
  const ensoFlow = useSolverEnso({
    tokenIn: params.depositToken,
    tokenOut: params.vaultAddress,
    amountIn: params.amount,
    fromAddress: params.account,
    chainId: params.chainId,
    destinationChainId: params.destinationChainId,
    receiver: params.account,
    decimalsOut: params.decimalsOut,
    slippage: params.slippage,
    enabled: params.enabled
  })
  const { getEnsoTransaction, getRoute, resetRoute } = ensoFlow.methods

  // Check if this is a native token (no approval needed)
  const isNativeToken = params.depositToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

  // Calculate if allowance is sufficient
  const isEnsoAllowanceSufficient =
    isNativeToken || !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

  useEffect(() => {
    resetRoute()
  }, [
    resetRoute,
    params.currentAmount,
    params.depositToken,
    params.vaultAddress,
    params.account,
    params.chainId,
    params.destinationChainId,
    params.slippage
  ])

  // Refetch the Enso route whenever any routing input changes.
  useEffect(() => {
    if (params.amount > 0n && params.enabled) {
      void getRoute()
    }
  }, [
    getRoute,
    params.amount,
    params.enabled,
    params.depositToken,
    params.vaultAddress,
    params.account,
    params.chainId,
    params.destinationChainId,
    params.slippage
  ])

  // Prepare Enso order for deposit
  const canDeposit = ensoFlow.periphery.route && params.amount > 0n && isEnsoAllowanceSufficient
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction,
    enabled: canDeposit,
    chainId: params.chainId
  })

  // Adapt ensoFlow to UseWidgetDepositFlowReturn interface
  return useMemo(
    (): UseWidgetDepositFlowReturn => ({
      actions: {
        prepareApprove: ensoFlow.actions.prepareApprove,
        prepareDeposit: prepareEnsoOrder
      },
      periphery: {
        prepareApproveEnabled: ensoFlow.periphery.prepareApproveEnabled,
        prepareDepositEnabled: Boolean(canDeposit && !ensoFlow.periphery.isLoadingRoute),
        isAllowanceSufficient: isEnsoAllowanceSufficient,
        allowance: ensoFlow.periphery.allowance,
        expectedOut: ensoFlow.periphery.expectedOut.raw,
        isLoadingRoute: ensoFlow.periphery.isLoadingRoute,
        isCrossChain: ensoFlow.periphery.isCrossChain,
        routerAddress: ensoFlow.periphery.routerAddress,
        error: ensoFlow.periphery.error?.message,
        tx: ensoFlow.periphery.route?.tx,
        gas: ensoFlow.periphery.route?.gas
      }
    }),
    [ensoFlow, prepareEnsoOrder, params.amount, isEnsoAllowanceSufficient]
  )
}
