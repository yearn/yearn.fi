import type { Address } from 'viem'

export type EnsoRoutingStrategy = 'router' | 'delegate' | 'router-legacy' | 'delegate-legacy' | 'ensowallet'

export const VAULT_ENSO_ROUTING_STRATEGY = 'router' as const satisfies EnsoRoutingStrategy

export function buildEnsoRouteRequestParams({
  fromAddress,
  chainId,
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  routingStrategy,
  destinationChainId,
  receiver
}: {
  fromAddress: Address
  chainId: number
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  slippage: number
  routingStrategy?: EnsoRoutingStrategy
  destinationChainId?: number
  receiver?: Address
}): URLSearchParams {
  const isCrossChain = destinationChainId !== undefined && destinationChainId !== chainId

  return new URLSearchParams({
    fromAddress,
    chainId: chainId.toString(),
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    slippage: slippage.toString(),
    ...(routingStrategy && { routingStrategy }),
    ...(isCrossChain && { destinationChainId: destinationChainId.toString() }),
    ...(receiver && { receiver })
  })
}
