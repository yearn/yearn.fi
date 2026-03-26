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
  const routeQueryKey = useMemo(
    () =>
      [
        params.chainId,
        params.destinationChainId ?? 'same-chain',
        params.depositToken,
        params.vaultAddress,
        params.account ?? 'no-account',
        params.slippage ?? 'default'
      ].join(':'),
    [
      params.chainId,
      params.destinationChainId,
      params.depositToken,
      params.vaultAddress,
      params.account,
      params.slippage
    ]
  )

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

  // Check if this is a native token (no approval needed)
  const isNativeToken = params.depositToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

  // Calculate if allowance is sufficient
  const isEnsoAllowanceSufficient =
    isNativeToken || !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

  useEffect(() => {
    ensoFlow.methods.resetRoute()
  }, [params.currentAmount, routeQueryKey, ensoFlow.methods.resetRoute])

  // Re-quote whenever any route-defining input changes, not just the amount.
  useEffect(() => {
    if (params.amount > 0n && params.enabled) {
      void ensoFlow.methods.getRoute()
    }
  }, [params.amount, params.enabled, routeQueryKey, ensoFlow.methods.getRoute])

  // Prepare Enso order for deposit
  const canDeposit = ensoFlow.periphery.route && params.amount > 0n && isEnsoAllowanceSufficient
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction: ensoFlow.methods.getEnsoTransaction,
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
