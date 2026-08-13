import { describe, expect, it } from 'vitest'
import { buildMaxQuoteRequestParams, resolveMaxQuoteSlippage } from './useFetchMaxQuote'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const DEPOSIT_TOKEN = '0x0000000000000000000000000000000000000002'
const DESTINATION_TOKEN = '0x0000000000000000000000000000000000000003'

describe('resolveMaxQuoteSlippage', () => {
  it('falls back to the user tolerance when the bootstrap quote is unavailable', () => {
    expect(
      resolveMaxQuoteSlippage({
        hasBootstrapQuote: false,
        userTolerancePercentage: 3,
        quoteImpactPercentage: 0
      })
    ).toBe(3)
  })

  it('reuses the remaining slippage once the bootstrap quote exposes price impact', () => {
    expect(
      resolveMaxQuoteSlippage({
        hasBootstrapQuote: true,
        userTolerancePercentage: 3,
        quoteImpactPercentage: 1
      })
    ).toBe(2.02)
  })
})

describe('buildMaxQuoteRequestParams', () => {
  it.each([
    { destinationChainId: 1, expectedDestinationChainId: null, route: 'same-chain' },
    { destinationChainId: 10, expectedDestinationChainId: '10', route: 'cross-chain' }
  ])('serializes the router-only policy for $route MAX quotes', ({
    destinationChainId,
    expectedDestinationChainId
  }) => {
    const params = buildMaxQuoteRequestParams({
      account: ACCOUNT,
      balance: 100n,
      depositToken: DEPOSIT_TOKEN,
      destinationToken: DESTINATION_TOKEN,
      sourceChainId: 1,
      destinationChainId,
      routeSlippage: 1
    })

    expect(params.get('routingStrategy')).toBe('router')
    expect(params.get('destinationChainId')).toBe(expectedDestinationChainId)
    expect(params.get('receiver')).toBe(ACCOUNT)
    expect(params.get('slippage')).toBe('100')
  })
})
