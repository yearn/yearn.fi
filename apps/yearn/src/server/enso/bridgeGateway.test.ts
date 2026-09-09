import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BRIDGE_GATEWAY_BACKOFF,
  bridgeGateway,
  runBridgeGateway,
  type TBridgeGatewayStore
} from '@/server/enso/bridgeGateway'

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
    client.eval.mockResolvedValueOnce(['claimed', '', '10']).mockResolvedValueOnce(['60010', '60000'])
    await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route-a', async () =>
      Response.json({ error: 'limited' }, { status: 429, headers: { 'Retry-After': '60' } })
    )
    expect(client.eval).toHaveBeenNthCalledWith(
      2,
      BRIDGE_GATEWAY_BACKOFF,
      ['yearn:enso-bridge:{credential}:budget'],
      ['60000', '0']
    )
    await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route-b', async () =>
      Response.json({ status: 'pending' })
    )
    expect(client.eval.mock.calls[0][1][2]).toBe(client.eval.mock.calls[2][1][2])
  })
})

it.each([
  ['600', ['600000', '0']],
  ['Wed, 09 Sep 2026 01:00:00 GMT', ['0', String(Date.parse('Wed, 09 Sep 2026 01:00:00 GMT'))]],
  ['invalid', ['30000', '0']],
  ['0', ['0', '0']]
])('interprets Retry-After %s without truncating valid provider backoff', async (header, expected) => {
  const client = store(['claimed', '', '10'])
  client.eval.mockResolvedValueOnce(['claimed', '', '10']).mockResolvedValueOnce(['600010', '600000'])
  await runBridgeGateway(client as unknown as TBridgeGatewayStore, 'credential', 'route', async () =>
    Response.json({ error: 'limited' }, { status: 429, headers: { 'Retry-After': header as string } })
  )
  expect(client.eval).toHaveBeenNthCalledWith(
    2,
    BRIDGE_GATEWAY_BACKOFF,
    ['yearn:enso-bridge:{credential}:budget'],
    expected
  )
})
