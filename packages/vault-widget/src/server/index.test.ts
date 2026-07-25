import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEnsoBalancesHandler,
  createEnsoBridgeStatusHandler,
  createEnsoRouteHandler,
  createEnsoStatusHandler,
  ENSO_BALANCES_CACHE_CONTROL
} from './index'

const txHash = `0x${'1'.repeat(64)}`
const account = '0x1111111111111111111111111111111111111111'
const tokenIn = '0x2222222222222222222222222222222222222222'
const tokenOut = '0x3333333333333333333333333333333333333333'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createEnsoBridgeStatusHandler', () => {
  it('proxies a validated bridge status request to its protocol endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ status: 'pending' }))
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBridgeStatusHandler({
      apiBaseUrl: 'https://api.example.test',
      apiKey: 'secret'
    })

    const response = await handler(
      new Request(`https://yearn.test/api/enso/bridge-status?protocol=ccip&chainId=1&txHash=${txHash}`)
    )

    expect(response.status).toBe(200)
    const [input, init] = fetcher.mock.calls[0]!
    expect(input.toString()).toBe(`https://api.example.test/api/v1/ccip/bridge/check?chainId=1&txHash=${txHash}`)
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
  })

  it('rejects unsupported protocols before proxying', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBridgeStatusHandler({ apiKey: 'secret' })

    const response = await handler(
      new Request(`https://yearn.test/api/enso/bridge-status?protocol=other&chainId=1&txHash=${txHash}`)
    )

    expect(response.status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('createEnsoRouteHandler', () => {
  it('validates both route chains before proxying', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoRouteHandler({
      apiKey: 'secret',
      policy: { allowedChainIds: [1, 10] }
    })
    const response = await handler(
      new Request(
        `https://yearn.test/api/enso/route?fromAddress=${account}&receiver=${account}&chainId=1&destinationChainId=42161&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=1&slippage=100`
      )
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported source or destination chain' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('forwards a validated route with bounded slippage', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ amountOut: '1' }))
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoRouteHandler({
      apiBaseUrl: 'https://api.example.test',
      apiKey: 'secret',
      policy: { allowedChainIds: [1], maxSlippageBps: 100 }
    })
    const response = await handler(
      new Request(
        `https://yearn.test/api/enso/route?fromAddress=${account}&chainId=1&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=1&slippage=100`
      )
    )

    expect(response.status).toBe(200)
    const [input] = fetcher.mock.calls[0]!
    expect(input.toString()).toContain('/api/v1/shortcuts/route?')
    expect(input.toString()).toContain(`receiver=${account}`)
    expect(input.toString()).toContain('slippage=100')
  })
})

describe('createEnsoBalancesHandler', () => {
  it('preserves all-chain EOA balance and cache options', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ balances: [] }))
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBalancesHandler({
      apiBaseUrl: 'https://api.example.test',
      apiKey: 'secret',
      cacheControl: ENSO_BALANCES_CACHE_CONTROL,
      defaultChainId: 'all',
      useEoa: true
    })
    const response = await handler(new Request(`https://yearn.test/api/enso/balances?eoaAddress=${account}`))

    expect(response.headers.get('Cache-Control')).toBe(ENSO_BALANCES_CACHE_CONTROL)
    const [input] = fetcher.mock.calls[0]!
    expect(input.toString()).toContain(`eoaAddress=${account}`)
    expect(input.toString()).toContain('chainId=all')
    expect(input.toString()).toContain('useEoa=true')
  })
})

describe('createEnsoStatusHandler', () => {
  it('reports local configuration without making an upstream request', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)

    await expect(
      createEnsoStatusHandler({ apiKey: 'secret', mode: 'configuration' })().then((r) => r.json())
    ).resolves.toEqual({ configured: true })
    await expect(createEnsoStatusHandler({ mode: 'configuration' })().then((r) => r.json())).resolves.toEqual({
      configured: false
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
