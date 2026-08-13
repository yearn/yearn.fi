import { describe, expect, it } from 'vitest'
import { buildEnsoRouteRequestParams } from './ensoRouteRequest'

const FROM_ADDRESS = '0x0000000000000000000000000000000000000001'
const TOKEN_IN = '0x0000000000000000000000000000000000000002'
const TOKEN_OUT = '0x0000000000000000000000000000000000000003'

describe('buildEnsoRouteRequestParams', () => {
  it.each([
    { destinationChainId: undefined, route: 'same-chain' },
    { destinationChainId: 10, route: 'cross-chain' }
  ])('serializes routingStrategy=router for $route routes', ({ destinationChainId }) => {
    const params = buildEnsoRouteRequestParams({
      fromAddress: FROM_ADDRESS,
      chainId: 1,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 100n,
      slippage: 100,
      routingStrategy: 'router',
      destinationChainId,
      receiver: FROM_ADDRESS
    })

    expect(params.get('routingStrategy')).toBe('router')
    expect(params.toString()).toContain('routingStrategy=router')
    expect(params.get('destinationChainId')).toBe(destinationChainId?.toString() ?? null)
  })
})
