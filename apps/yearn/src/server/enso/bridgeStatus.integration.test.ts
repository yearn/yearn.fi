import { createHash } from 'node:crypto'
import { normalizeEnsoSettlement } from '@shared/hooks/ensoSettlement'
import { selectTransaction, type TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRIDGE_GATEWAY_BACKOFF, BRIDGE_GATEWAY_CLAIM } from '@/server/enso/bridgeGateway'
import { GET } from '@/server/enso/bridgeStatus'

const redis = vi.hoisted(() => ({ eval: vi.fn(), set: vi.fn() }))
vi.mock('@upstash/redis', () => ({
  Redis: class {
    eval = redis.eval
    set = redis.set
  }
}))
const source = `0x${'a'.repeat(64)}` as const
const other = `0x${'b'.repeat(64)}` as const
const requestId = `0x${'c'.repeat(64)}` as const
const time = 1_000_000
const identity = (params: Record<string, unknown>) => JSON.stringify(params)
const key = (payload: string) => createHash('sha256').update(payload).digest('hex')
const get = (params: Record<string, string>) =>
  GET(new Request(`https://yearn.fi/api/enso/bridge-status?${new URLSearchParams(params)}`))
const queued = (params: Record<string, unknown>) => {
  const payload = identity(params)
  redis.eval.mockResolvedValueOnce(['claimed', payload, String(time), key(payload)])
  return payload
}

beforeEach(() => {
  vi.stubEnv('ENSO_API_KEY', 'test-key')
  vi.stubEnv('RELAY_API_KEY', '')
  vi.stubEnv('UPSTASH_REDIS_REST_URL_BRIDGE_COORDINATION', 'https://redis.invalid')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_BRIDGE_COORDINATION', 'test-token')
  redis.set.mockResolvedValue('OK')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

describe('bridge API and shared gateway integration', () => {
  it.each(['', 'false'])('requires coordination even when the retired flag is %j', async (flag) => {
    vi.stubEnv('NEXT_PUBLIC_TRANSACTION_LIFECYCLE_BRIDGES', flag)
    vi.stubEnv('UPSTASH_REDIS_REST_URL_BRIDGE_COORDINATION', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_BRIDGE_COORDINATION', '')
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const response = await get({ protocol: 'ccip', chainId: '1', txHash: source })
    expect(response.status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('executes the queued protocol, chain and hash and caches only that result', async () => {
    const payload = queued({ protocol: 'ccip', chainId: 1, txHash: source })
    const fetchMock = vi.fn(async (url: string) =>
      Response.json({ status: url.includes(other) ? 'delivered' : 'pending', destinationChainId: 10 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const caller = await get({ protocol: 'stargate', chainId: '8453', txHash: other })
    expect(caller.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `https://api.enso.finance/api/v1/ccip/bridge/check?chainId=1&txHash=${source}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(redis.set.mock.calls[0][0]).toContain(`:cache:${key(payload)}`)
    const saved = JSON.parse(redis.set.mock.calls[0][1])
    redis.eval.mockResolvedValueOnce(['cached', JSON.stringify(saved), String(time + 1000)])
    const cached = await get({ protocol: 'ccip', chainId: '1', txHash: source })
    const data = await cached.json()
    expect(data).toMatchObject({ status: 'pending', observedAt: time })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const record = {
      original: { canonicalChainId: 1, executionChainId: 1, hash: source },
      effective: { canonicalChainId: 1, executionChainId: 1, hash: source },
      settlement: { provider: 'enso', destinationChainId: 10, protocols: ['ccip'], coverage: 'incomplete', legs: [] },
      source: { receipt: { status: 'success' } },
      refresh: 'idle'
    } as TTransactionRecord
    expect(selectTransaction({ ...record, destination: normalizeEnsoSettlement(data, record, time) }).outcome).toBe(
      'pending'
    )
  })

  it.each([source, undefined])('retains a queued Relay request ID with source hash %s', async (txHash) => {
    queued({ protocol: 'relay', chainId: 1, txHash, requestId })
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'success', destinationChainId: 10 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await get({ protocol: 'ccip', chainId: '8453', txHash: other })).status).toBe(429)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `https://api.relay.link/intents/status/v3?requestId=${requestId}`,
      expect.any(Object)
    )
    expect(JSON.parse(redis.set.mock.calls[0][1]).body).toMatchObject({
      bridgeRequestId: requestId,
      sourceChainId: 1,
      status: 'delivered'
    })
  })

  it('retains Relay fallback for the selected source transaction', async () => {
    queued({ protocol: 'relay', chainId: 1, txHash: source, requestId })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ status: 'pending' }))
    vi.stubGlobal('fetch', fetchMock)
    await get({ protocol: 'ccip', chainId: '8453', txHash: other })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.enso.finance/api/v1/relay/bridge/check?chainId=1&txHash=${source}`,
      expect.any(Object)
    )
  })

  it.each([
    { protocol: '../invalid', chainId: 1, txHash: source },
    { protocol: 'ccip', chainId: 0, txHash: source },
    { protocol: 'ccip', chainId: 1, txHash: 'invalid' },
    { protocol: 'relay', chainId: 1, requestId: 'invalid' }
  ])('rejects invalid queued work before upstream access: %j', async (params) => {
    queued(params)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await get({ protocol: 'ccip', chainId: '1', txHash: other })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(JSON.parse(redis.set.mock.calls[0][1]).status).toBe(502)
  })

  it.each(['json', 'text'])(
    'carries provider backoff into shared coordination, cache and client retry time (%s)',
    async (format) => {
      queued({ protocol: 'ccip', chainId: 1, txHash: source })
      redis.eval.mockResolvedValueOnce([String(time + 120_000), '120000'])
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            format === 'json'
              ? Response.json({ error: 'limited' }, { status: 429, headers: { 'Retry-After': '120' } })
              : new Response('Too many requests', { status: 429, headers: { 'Retry-After': '120' } })
          )
      )
      const result = await get({ protocol: 'ccip', chainId: '1', txHash: source })
      expect(result.status).toBe(429)
      expect(result.headers.get('Retry-After')).toBe('120')
      expect(await result.json()).toMatchObject({ nextCheckAt: time + 120_000 })
      expect(redis.eval).toHaveBeenNthCalledWith(
        2,
        BRIDGE_GATEWAY_BACKOFF,
        [expect.stringContaining(':budget')],
        ['120000', '0']
      )
      const saved = JSON.parse(redis.set.mock.calls[0][1])
      redis.eval.mockResolvedValueOnce(['cached', JSON.stringify(saved), String(time + 2000)])
      const cached = await get({ protocol: 'ccip', chainId: '1', txHash: source })
      expect(cached.headers.get('Retry-After')).toBe('118')
      expect(await cached.json()).toMatchObject({ observedAt: time, nextCheckAt: time + 120_000 })
      expect(redis.eval.mock.calls[0][0]).toBe(BRIDGE_GATEWAY_CLAIM)
    }
  )
})
