import { afterEach, describe, expect, it, vi } from 'vitest'
import { canonicalChains } from '@/config/chainDefinitions'
import { GET } from './status'

function rpcResponse(chainId: number): Response {
  return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${chainId.toString(16)}` })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('site status', () => {
  it('reports Kong and every supported RPC as operational', async () => {
    const rpcResponses = canonicalChains.map((chain) => rpcResponse(chain.id))
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockImplementation(() => Promise.resolve(rpcResponses.shift() as Response))

    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=30')
    expect(payload.services.kong.state).toBe('operational')
    expect(payload.services.rpc).toMatchObject({
      state: 'operational',
      operational: canonicalChains.length,
      total: canonicalChains.length
    })
    expect(JSON.stringify(payload)).not.toContain('http')
  })

  it('reports degraded RPC health when one supported chain fails', async () => {
    const rpcResponses = canonicalChains.map((chain, index) =>
      index === 0 ? Response.json({ error: 'unavailable' }, { status: 503 }) : rpcResponse(chain.id)
    )
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(() => Promise.resolve(rpcResponses.shift() as Response))

    const response = await GET()
    const payload = await response.json()

    expect(payload.services.kong.state).toBe('unavailable')
    expect(payload.services.rpc).toMatchObject({
      state: 'degraded',
      operational: canonicalChains.length - 1,
      total: canonicalChains.length
    })
    expect(payload.services.rpc.chains[0]).toMatchObject({ chainId: 1, state: 'unavailable' })
  })
})
