import type { UseWidgetDepositFlowReturn } from '@nextgen/types'
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

  // Check if this is a native token (no approval needed)
  const isNativeToken = params.depositToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

  // Calculate if allowance is sufficient
  const isEnsoAllowanceSufficient =
    isNativeToken || !ensoFlow.periphery.routerAddress || ensoFlow.periphery.allowance >= params.amount

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
        prepareDepositEnabled: !!ensoFlow.periphery.route && params.amount > 0n,
        isAllowanceSufficient: isEnsoAllowanceSufficient,
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
