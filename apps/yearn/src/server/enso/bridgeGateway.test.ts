import { afterEach, describe, expect, it, vi } from 'vitest'
import { bridgeGateway, runBridgeGateway, type TBridgeGatewayStore } from '@/server/enso/bridgeGateway'

const store = (claim: [string, string, string]) => ({
  eval: vi.fn().mockResolvedValue(claim),
  set: vi.fn().mockResolvedValue('OK')
})
afterEach(() => vi.unstubAllEnvs())
describe('shared bridge gateway', () => {
  it('fails closed without shared coordination and never calls upstream', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const request = vi.fn()
    expect((await bridgeGateway('route', request)).status).toBe(503)
    expect(request).not.toHaveBeenCalled()
  })
  it('defers a competing request without treating the transaction as failed', async () => {
    const client = store(['deferred', '', '30000'])
    const request = vi.fn()
    const response = await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route', request)
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ nextCheckAt: 30000 })
    expect(request).not.toHaveBeenCalled()
  })
  it('returns cached evidence with the original observation time', async () => {
    const client = store([
      'cached',
      JSON.stringify({ body: { status: 'delivered', observedAt: 10, nextCheckAt: 30 }, status: 200 }),
      '20'
    ])
    const request = vi.fn()
    const response = await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route', request)
    expect(await response.json()).toMatchObject({ observedAt: 10, nextCheckAt: 30 })
    expect(request).not.toHaveBeenCalled()
  })
  it('stores successful evidence, passes a bounded abort signal, and hashes public cache identities', async () => {
    const client = store(['claimed', '', '10'])
    const request = vi.fn().mockResolvedValue(Response.json({ status: 'pending' }))
    const response = await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route', request)
    expect(await response.json()).toMatchObject({ status: 'pending', observedAt: 10, nextCheckAt: 30010 })
    expect(request).toHaveBeenCalledWith(expect.any(AbortSignal), 'route')
    expect(client.set.mock.calls[0][0]).toMatch(/^yearn:enso-bridge:\{credential\}:cache:[a-f0-9]{64}$/)
  })
  it('shares the credential budget across distinct routes and retains provider backoff', async () => {
    const client = store(['claimed', '', '10'])
    await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route-a', async () =>
      Response.json({ error: 'limited' }, { status: 429, headers: { 'Retry-After': '60' } })
    )
    expect(client.set).toHaveBeenLastCalledWith('yearn:enso-bridge:{credential}:budget', 'backoff', { px: 60000 })
    await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route-b', async () =>
      Response.json({ status: 'pending' })
    )
    expect(client.eval.mock.calls[0][1][2]).toBe(client.eval.mock.calls[1][1][2])
  })
})
