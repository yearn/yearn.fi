import { describe, expect, it } from 'vitest'
import { normalizeEnsoRoute } from './enso'

const account = '0x1111111111111111111111111111111111111111'
const router = '0x2222222222222222222222222222222222222222'

const request = {
  account,
  amountIn: 100n,
  chainId: 1,
  destinationChainId: 1,
  receiver: account,
  slippageBps: 100,
  tokenIn: '0x3333333333333333333333333333333333333333',
  tokenOut: '0x4444444444444444444444444444444444444444'
} as const

describe('normalizeEnsoRoute', () => {
  it('normalizes a trusted route', () => {
    expect(
      normalizeEnsoRoute(
        {
          amountOut: '90',
          minAmountOut: '88',
          priceImpact: 75,
          route: [{ action: 'swap' }],
          tx: {
            chainId: 1,
            data: '0x1234',
            from: account,
            to: router,
            value: '0'
          }
        },
        request,
        { 1: [router] }
      )
    ).toEqual({
      amountOut: 90n,
      minAmountOut: 88n,
      priceImpactPercent: 0.75,
      routeHasSwap: true,
      transaction: {
        chainId: 1,
        data: '0x1234',
        from: account,
        to: router,
        value: 0n
      }
    })
  })

  it('rejects an untrusted router', () => {
    expect(() =>
      normalizeEnsoRoute(
        {
          amountOut: '90',
          minAmountOut: '88',
          tx: {
            chainId: 1,
            data: '0x1234',
            from: account,
            to: '0x5555555555555555555555555555555555555555',
            value: '0'
          }
        },
        request,
        { 1: [router] }
      )
    ).toThrow('unrecognized router')
  })

  it('rejects a route for another sender', () => {
    expect(() =>
      normalizeEnsoRoute(
        {
          amountOut: '90',
          minAmountOut: '88',
          tx: {
            chainId: 1,
            data: '0x1234',
            from: '0x6666666666666666666666666666666666666666',
            to: router,
            value: '0'
          }
        },
        request,
        { 1: [router] }
      )
    ).toThrow('connected account')
  })

  it('rejects minimum output above the quoted output', () => {
    expect(() =>
      normalizeEnsoRoute(
        {
          amountOut: '90',
          minAmountOut: '91',
          tx: {
            chainId: 1,
            data: '0x1234',
            from: account,
            to: router,
            value: '0'
          }
        },
        request,
        { 1: [router] }
      )
    ).toThrow('inconsistent output amounts')
  })
})
