import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'

function routeRequest(extra: Record<string, string> = {}): Request {
  const params = new URLSearchParams({
    fromAddress: ACCOUNT,
    chainId: '1',
    tokenIn: OTHER,
    tokenOut: OTHER,
    amountIn: '1',
    ...extra
  })
  return new Request(`https://yearn.fi/api/enso/route?${params}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Enso route proxy', () => {
  it.each([{ receiver: OTHER }, { routingStrategy: 'delegate' }])('rejects %o without calling Enso', async (extra) => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    vi.stubEnv('ENSO_API_KEY', 'key')

    const response = await GET(routeRequest(extra))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('pins routingStrategy=router and never caches the quote', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ tx: {} }))
    vi.stubGlobal('fetch', fetchStub)
    vi.stubEnv('ENSO_API_KEY', 'key')

    const response = await GET(routeRequest({ receiver: ACCOUNT.toUpperCase().replace('0X', '0x') }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('private, no-store')
    expect(new URL(fetchStub.mock.calls[0][0]).searchParams.get('routingStrategy')).toBe('router')
  })

  it('forwards a cross-chain request whose receiver is the sender', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ tx: {} }))
    vi.stubGlobal('fetch', fetchStub)
    vi.stubEnv('ENSO_API_KEY', 'key')

    const response = await GET(
      routeRequest({ destinationChainId: '8453', receiver: ACCOUNT, routingStrategy: 'router' })
    )
    const upstream = new URL(fetchStub.mock.calls[0][0]).searchParams

    expect(response.status).toBe(200)
    expect(upstream.get('destinationChainId')).toBe('8453')
    expect(upstream.get('receiver')).toBe(ACCOUNT)
    expect(upstream.get('routingStrategy')).toBe('router')
  })
})
