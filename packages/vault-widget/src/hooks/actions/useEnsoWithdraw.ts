import type { UseWidgetWithdrawFlowReturn } from '@yearn/vault-widget/types'
import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { VAULT_ENSO_ROUTING_STRATEGY } from '../solvers/ensoRouteRequest'
import type { EnsoQuotePurpose } from '../solvers/useSolverEnso'
import { useSolverEnso } from '../solvers/useSolverEnso'
import { useEnsoOrder } from '../useEnsoOrder'
import { refreshEnsoReadiness } from './ensoReadiness'

interface UseEnsoWithdrawParams {
  vaultAddress: Address
  withdrawToken: Address
  amount: bigint
  account?: Address
  receiver?: Address
  chainId: number
  destinationChainId?: number
  decimalsOut: number
  enabled: boolean
  slippage?: number
  quotePurpose?: EnsoQuotePurpose
  isPreparingAmount?: boolean
  amountError?: string
}

export function useEnsoWithdraw(params: UseEnsoWithdrawParams): UseWidgetWithdrawFlowReturn {
  const routeQueryKey = useMemo(
    () =>
      [
        params.chainId,
        params.destinationChainId ?? 'same-chain',
        params.vaultAddress,
        params.withdrawToken,
        params.account ?? 'no-account',
        params.receiver ?? 'no-receiver',
        params.slippage ?? 'default',
        VAULT_ENSO_ROUTING_STRATEGY
      ].join(':'),
    [
      params.chainId,
      params.destinationChainId,
      params.vaultAddress,
      params.withdrawToken,
      params.account,
      params.receiver,
      params.slippage
    ]
  )

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
    quotePurpose: params.quotePurpose,
    routingStrategy: VAULT_ENSO_ROUTING_STRATEGY,
    requestKey: routeQueryKey,
    enabled: params.enabled && !params.isPreparingAmount && !params.amountError
  })

  // Calculate if allowance is sufficient
  const isAllowanceSufficient = !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

  // Prepare Enso order for withdrawal
  const canWithdraw = ensoFlow.periphery.route && params.amount > 0n && isAllowanceSufficient
  const isPreparingRoute = ensoFlow.periphery.isLoadingRoute || Boolean(params.isPreparingAmount)
  const refreshReadiness = useCallback(async () => {
    await refreshEnsoReadiness(ensoFlow.periphery.refetchAllowance, ensoFlow.methods.getRoute)
  }, [ensoFlow.methods.getRoute, ensoFlow.periphery.refetchAllowance])
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction: ensoFlow.methods.getEnsoTransaction,
    refreshEnsoTransaction: refreshReadiness,
    routeError: params.amountError ?? ensoFlow.periphery.error?.message,
    isPreparingRoute,
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
        prepareWithdrawEnabled: !!canWithdraw && !isPreparingRoute,
        isAllowanceSufficient,
        allowance: ensoFlow.periphery.allowance,
        expectedOut: ensoFlow.periphery.expectedOut.raw,
        minExpectedOut: ensoFlow.periphery.minExpectedOut.raw,
        priceImpact: ensoFlow.periphery.priceImpact,
        isLoadingRoute: isPreparingRoute,
        isCrossChain: ensoFlow.periphery.isCrossChain,
        routeHasSwap: ensoFlow.periphery.routeHasSwap,
        bridgeProtocol: ensoFlow.periphery.bridgeProtocol,
        routerAddress: ensoFlow.periphery.routerAddress,
        error: params.amountError ?? ensoFlow.periphery.error?.message,
        shareAmount: params.amount,
        tx: ensoFlow.periphery.route?.tx,
        gas: ensoFlow.periphery.route?.gas,
        resetQuote: ensoFlow.methods.resetRoute
      }
    }),
    [
      ensoFlow,
      prepareEnsoOrder,
      canWithdraw,
      isAllowanceSufficient,
      isPreparingRoute,
      params.amount,
      params.amountError
    ]
  )
}
