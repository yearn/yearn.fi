import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeGateway } from '@/server/enso/bridgeGateway'

// Keep the actual Upstash SDK: it recursively deserializes JSON in Lua results
// by default, including queue payloads and cached responses.
const identity = JSON.stringify({ protocol: 'ccip', chainId: 1, txHash: `0x${'a'.repeat(64)}` })
beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL_BRIDGE_COORDINATION', 'https://redis.invalid')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_BRIDGE_COORDINATION', 'test-token')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('gateway Upstash serialization', () => {
  it('passes a queued JSON identity intact to the provider adapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const commands = JSON.parse(init.body)
        const reply = (command: string[]) => ({
          result:
            command[0].toLowerCase() === 'eval'
              ? ['claimed', identity, '1000', 'route-key'].map((value) => Buffer.from(value).toString('base64'))
              : 'OK'
        })
        return Response.json(Array.isArray(commands[0]) ? commands.map(reply) : reply(commands))
      })
    )
    const request = vi.fn(async () => Response.json({ status: 'inflight' }))
    await bridgeGateway(identity, request)
    expect(request).toHaveBeenCalledWith(expect.any(AbortSignal), identity)
  })
  it('decodes cached JSON exactly once without another provider request', async () => {
    const saved = JSON.stringify({ body: { status: 'inflight', observedAt: 500, nextCheckAt: 30000 }, status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const commands = JSON.parse(init.body)
        const reply = { result: ['cached', saved, '1000'].map((value) => Buffer.from(value).toString('base64')) }
        return Response.json(Array.isArray(commands[0]) ? [reply] : reply)
      })
    )
    const request = vi.fn()
    const response = await bridgeGateway(identity, request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'inflight', observedAt: 500, nextCheckAt: 30000 })
    expect(request).not.toHaveBeenCalled()
  })
})
