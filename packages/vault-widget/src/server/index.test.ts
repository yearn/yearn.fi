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

  it('rejects unsupported chains by default and permits an explicit host override', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ status: 'pending' }))
    vi.stubGlobal('fetch', fetcher)
    const request = new Request(`https://yearn.test/api/enso/bridge-status?protocol=relay&chainId=56&txHash=${txHash}`)

    expect((await createEnsoBridgeStatusHandler({ apiKey: 'secret' })(request.clone())).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
    expect(
      (
        await createEnsoBridgeStatusHandler({
          allowedChainIds: [56],
          apiKey: 'secret'
        })(request)
      ).status
    ).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
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

  it.each([
    { key: 'chainId', name: 'zero chain', value: '0' },
    { key: 'chainId', name: 'unsafe chain', value: '9007199254740992' },
    { key: 'slippage', name: 'non-decimal slippage', value: '1e2' },
    { key: 'routingStrategy', name: 'delegate routing', value: 'delegate' },
    { key: 'fromAddress', name: 'zero sender', value: '0x0000000000000000000000000000000000000000' },
    { key: 'receiver', name: 'zero receiver', value: '0x0000000000000000000000000000000000000000' },
    {
      key: 'amountIn',
      name: 'amount above uint256',
      value: (2n ** 256n).toString()
    }
  ])('rejects a $name before proxying', async ({ key, value }) => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const url = new URL('https://yearn.test/api/enso/route')
    url.search = new URLSearchParams({
      amountIn: '1',
      chainId: '1',
      fromAddress: account,
      routingStrategy: 'router',
      slippage: '100',
      tokenIn,
      tokenOut
    }).toString()
    url.searchParams.set(key, value)

    expect((await createEnsoRouteHandler({ apiKey: 'secret' })(new Request(url))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('requires an explicit source chain and applies the packaged supported-chain policy by default', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const base = new URL(
      `https://yearn.test/api/enso/route?fromAddress=${account}&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=1&slippage=100`
    )

    expect((await createEnsoRouteHandler({ apiKey: 'secret' })(new Request(base))).status).toBe(400)
    base.searchParams.set('chainId', '56')
    await expect(
      createEnsoRouteHandler({ apiKey: 'secret' })(new Request(base)).then((response) => response.json())
    ).resolves.toEqual({ error: 'Unsupported source or destination chain' })
    expect(fetcher).not.toHaveBeenCalled()
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

  it('rejects unsafe and unsupported balance chains before proxying', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBalancesHandler({ apiKey: 'secret' })

    expect(
      (
        await handler(
          new Request(`https://yearn.test/api/enso/balances?eoaAddress=${account}&chainId=9007199254740992`)
        )
      ).status
    ).toBe(400)
    expect(
      (await handler(new Request(`https://yearn.test/api/enso/balances?eoaAddress=${account}&chainId=56`))).status
    ).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('allows hosts to extend the balance-chain policy explicitly', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ balances: [] }))
    vi.stubGlobal('fetch', fetcher)
    const response = await createEnsoBalancesHandler({
      allowedChainIds: [56],
      apiKey: 'secret'
    })(new Request(`https://yearn.test/api/enso/balances?eoaAddress=${account}&chainId=56`))

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
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
