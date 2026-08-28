import { describe, expect, it } from 'vitest'
import { buildEnsoRouteRequestParams, VAULT_ENSO_ROUTING_STRATEGY } from './ensoRouteRequest'

const TOKEN_IN = '0x0000000000000000000000000000000000000001'
const TOKEN_OUT = '0x0000000000000000000000000000000000000002'
const ACCOUNT = '0x0000000000000000000000000000000000000003'

describe('buildEnsoRouteRequestParams', () => {
  it.each([
    { label: 'same-chain', destinationChainId: 1 },
    { label: 'cross-chain', destinationChainId: 8453 }
  ])('serializes router execution for a $label vault zap', ({ destinationChainId }) => {
    const params = buildEnsoRouteRequestParams({
      fromAddress: ACCOUNT,
      chainId: 1,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 10n,
      slippage: 100,
      routingStrategy: VAULT_ENSO_ROUTING_STRATEGY,
      destinationChainId,
      receiver: ACCOUNT
    })

    expect(params.get('routingStrategy')).toBe('router')
    expect(params.get('destinationChainId')).toBe(destinationChainId === 1 ? null : '8453')
  })
})
