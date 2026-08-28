import type { UseWidgetDepositFlowReturn } from '@yearn/vault-widget/types'
import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { VAULT_ENSO_ROUTING_STRATEGY } from '../solvers/ensoRouteRequest'
import type { EnsoQuotePurpose } from '../solvers/useSolverEnso'
import { useSolverEnso } from '../solvers/useSolverEnso'
import { useEnsoOrder } from '../useEnsoOrder'
import { refreshEnsoReadiness } from './ensoReadiness'

interface UseEnsoDepositParams {
  vaultAddress: Address
  depositToken: Address
  amount: bigint
  account?: Address
  chainId: number
  destinationChainId?: number
  decimalsOut: number
  enabled: boolean
  slippage?: number
  quotePurpose?: EnsoQuotePurpose
  routeRefreshKey?: number
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
        params.slippage ?? 'default',
        VAULT_ENSO_ROUTING_STRATEGY,
        params.routeRefreshKey ?? 0
      ].join(':'),
    [
      params.chainId,
      params.destinationChainId,
      params.depositToken,
      params.vaultAddress,
      params.account,
      params.slippage,
      params.routeRefreshKey
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
    quotePurpose: params.quotePurpose,
    routingStrategy: VAULT_ENSO_ROUTING_STRATEGY,
    requestKey: routeQueryKey,
    enabled: params.enabled
  })

  // Check if this is a native token (no approval needed)
  const isNativeToken = params.depositToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

  // Calculate if allowance is sufficient
  const isEnsoAllowanceSufficient =
    isNativeToken || !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

  // Prepare Enso order for deposit
  const canDeposit = ensoFlow.periphery.route && params.amount > 0n && isEnsoAllowanceSufficient
  const refreshReadiness = useCallback(async () => {
    await refreshEnsoReadiness(ensoFlow.periphery.refetchAllowance, ensoFlow.methods.getRoute)
  }, [ensoFlow.methods.getRoute, ensoFlow.periphery.refetchAllowance])
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction: ensoFlow.methods.getEnsoTransaction,
    refreshEnsoTransaction: refreshReadiness,
    routeError: ensoFlow.periphery.error?.message,
    isPreparingRoute: ensoFlow.periphery.isLoadingRoute,
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
        minExpectedOut: ensoFlow.periphery.minExpectedOut.raw,
        priceImpact: ensoFlow.periphery.priceImpact,
        isLoadingRoute: ensoFlow.periphery.isLoadingRoute,
        isCrossChain: ensoFlow.periphery.isCrossChain,
        routeHasSwap: ensoFlow.periphery.routeHasSwap,
        bridgeProtocol: ensoFlow.periphery.bridgeProtocol,
        routerAddress: ensoFlow.periphery.routerAddress,
        approvalSpenderAddress: ensoFlow.periphery.approvalSpenderAddress,
        approvalWarning: ensoFlow.periphery.approvalWarning,
        error: ensoFlow.periphery.error?.message,
        tx: ensoFlow.periphery.route?.tx,
        gas: ensoFlow.periphery.route?.gas,
        refetchAllowance: ensoFlow.periphery.refetchAllowance
      }
    }),
    [ensoFlow, prepareEnsoOrder, params.amount, isEnsoAllowanceSufficient]
  )
}
