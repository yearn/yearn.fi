import { describe, expect, it, vi } from 'vitest'
import { createHttpEnsoQuoteProvider, normalizeEnsoRoute } from './enso'

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

  it('normalizes bridge tracking metadata for cross-chain routes', () => {
    expect(
      normalizeEnsoRoute(
        {
          amountOut: '90',
          bridgingEstimates: [{ estimatedSeconds: 45, protocol: 'Stargate' }],
          minAmountOut: '88',
          route: [{ action: 'bridge', protocol: 'Stargate' }],
          tx: {
            chainId: 1,
            data: '0x1234',
            from: account,
            to: router,
            value: '0'
          }
        },
        { ...request, destinationChainId: 8453 },
        { 1: [router] }
      ).bridge
    ).toEqual({
      destinationChainId: 8453,
      estimatedSeconds: 45,
      protocol: 'stargate',
      sourceChainId: 1
    })
  })

  it('rejects cross-chain routes without a supported bridge protocol', () => {
    expect(() =>
      normalizeEnsoRoute(
        {
          amountOut: '90',
          minAmountOut: '88',
          route: [{ action: 'bridge', protocol: 'unknown' }],
          tx: {
            chainId: 1,
            data: '0x1234',
            from: account,
            to: router,
            value: '0'
          }
        },
        { ...request, destinationChainId: 8453 },
        { 1: [router] }
      )
    ).toThrow('unsupported bridge protocol')
  })
})

describe('createHttpEnsoQuoteProvider', () => {
  it('requotes with only the slippage remaining after route impact', async () => {
    const abortController = new AbortController()
    const payload = {
      amountOut: '90',
      minAmountOut: '88',
      priceImpact: 50,
      route: [{ action: 'swap' }],
      tx: {
        chainId: 1,
        data: '0x1234',
        from: account,
        to: router,
        value: '0'
      }
    }
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload))
    const provider = createHttpEnsoQuoteProvider({
      endpoint: '/api/enso/route',
      fetcher,
      trustedRouters: { 1: [router] }
    })

    await provider.getRoute({ ...request, signal: abortController.signal, slippageBps: 100 })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.every(([, init]) => init?.signal === abortController.signal)).toBe(true)
    expect(new URL(fetcher.mock.calls[0]![0].toString(), 'https://yearn.test').searchParams.get('slippage')).toBe('0')
    expect(new URL(fetcher.mock.calls[1]![0].toString(), 'https://yearn.test').searchParams.get('slippage')).toBe('50')
  })

  it('blocks execution when route impact consumes the complete tolerance', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        amountOut: '90',
        minAmountOut: '88',
        priceImpact: 100,
        route: [{ action: 'swap' }],
        tx: {
          chainId: 1,
          data: '0x1234',
          from: account,
          to: router,
          value: '0'
        }
      })
    )
    const provider = createHttpEnsoQuoteProvider({
      fetcher,
      trustedRouters: { 1: [router] }
    })

    await expect(provider.getRoute({ ...request, slippageBps: 100 })).rejects.toThrow('transaction tolerance')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
