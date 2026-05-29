import type { VercelRequest } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import balancesHandler from './balances'
import { resetEnsoRateLimitForTests } from './guard'
import routeHandler from './route'

const ADDRESS_A = '0x1111111111111111111111111111111111111111'
const ADDRESS_B = '0x2222222222222222222222222222222222222222'
const ADDRESS_C = '0x3333333333333333333333333333333333333333'

type TMockResponse = {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (code: number) => TMockResponse
  json: (payload: unknown) => TMockResponse
}

function createMockResponse(): TMockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name: string, value: string) {
      this.headers[name] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    }
  }
}

function quoteRequest(query: Record<string, unknown> = {}, ip = '203.0.113.10'): VercelRequest {
  return {
    method: 'GET',
    headers: {
      'x-forwarded-for': `${ip}, 10.0.0.1`
    },
    query: {
      fromAddress: ADDRESS_A,
      chainId: '1',
      tokenIn: ADDRESS_B,
      tokenOut: ADDRESS_C,
      amountIn: '1000000000000000000',
      ...query
    }
  } as VercelRequest
}

function balancesRequest(query: Record<string, unknown> = {}, ip = '203.0.113.20'): VercelRequest {
  return {
    method: 'GET',
    headers: {
      'x-forwarded-for': ip
    },
    query: {
      eoaAddress: ADDRESS_A,
      ...query
    }
  } as VercelRequest
}

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function rejectOnAbort(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
}

describe('Enso API proxy guards', () => {
  beforeEach(() => {
    resetEnsoRateLimitForTests()
    process.env.ENSO_API_KEY = 'test-enso-key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(okJson({ ok: true })))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    delete process.env.ENSO_API_KEY
  })

  it('forwards valid quote requests with the server-side API key and default slippage', async () => {
    const res = createMockResponse()

    await routeHandler(quoteRequest(), res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    const requestUrl = new URL(String(url))

    expect(requestUrl.searchParams.get('fromAddress')).toBe(ADDRESS_A)
    expect(requestUrl.searchParams.get('chainId')).toBe('1')
    expect(requestUrl.searchParams.get('amountIn')).toBe('1000000000000000000')
    expect(requestUrl.searchParams.get('slippage')).toBe('100')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-enso-key',
      'Content-Type': 'application/json'
    })
  })

  it('forwards valid balance requests with the server-side API key and existing parameters', async () => {
    const res = createMockResponse()

    await balancesHandler(balancesRequest(), res as any)

    expect(res.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    const requestUrl = new URL(String(url))

    expect(requestUrl.searchParams.get('eoaAddress')).toBe(ADDRESS_A)
    expect(requestUrl.searchParams.get('useEoa')).toBe('true')
    expect(requestUrl.searchParams.get('chainId')).toBe('all')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-enso-key'
    })
  })

  it('rate limits quote requests per forwarded client IP while allowing a different IP bucket', async () => {
    const responses = await Promise.all(
      Array.from({ length: 31 }, async () => {
        const res = createMockResponse()
        await routeHandler(quoteRequest({}, '198.51.100.1'), res as any)
        return res
      })
    )
    const otherIpResponse = createMockResponse()

    await routeHandler(quoteRequest({}, '198.51.100.2'), otherIpResponse as any)

    expect(responses.at(-1)?.statusCode).toBe(429)
    expect(responses.at(-1)?.body).toEqual({ error: 'Too many Enso route requests' })
    expect(otherIpResponse.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(31)
  })

  it('rate limits balance requests per forwarded client IP', async () => {
    const responses = await Promise.all(
      Array.from({ length: 21 }, async () => {
        const res = createMockResponse()
        await balancesHandler(balancesRequest({}, '198.51.100.3'), res as any)
        return res
      })
    )

    expect(responses.at(-1)?.statusCode).toBe(429)
    expect(responses.at(-1)?.body).toEqual({ error: 'Too many Enso balance requests' })
    expect(fetch).toHaveBeenCalledTimes(20)
  })

  it('rejects malformed quote inputs before calling upstream', async () => {
    const invalidCases = [
      { fromAddress: '0xbad' },
      { chainId: 'mainnet' },
      { amountIn: '-1' },
      { amountIn: '1'.repeat(81) },
      { slippage: '1001' }
    ]

    const responses = await Promise.all(
      invalidCases.map(async (query, index) => {
        const res = createMockResponse()
        await routeHandler(quoteRequest(query, `203.0.113.${30 + index}`), res as any)
        return res
      })
    )

    expect(responses.map((res) => res.statusCode)).toEqual([400, 400, 400, 400, 400])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects malformed balance addresses before calling upstream', async () => {
    const res = createMockResponse()

    await balancesHandler(balancesRequest({ eoaAddress: '0xbad' }), res as any)

    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps quote upstream aborts to HTTP 504 without leaking upstream details', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
      )
    )

    const res = createMockResponse()
    const request = routeHandler(quoteRequest(), res as any)

    await vi.advanceTimersByTimeAsync(8_000)
    await request

    expect(res.statusCode).toBe(504)
    expect(res.body).toEqual({ error: 'Enso route request timed out' })
  })

  it('keeps the quote timeout active while reading the upstream body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string | URL | Request, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => rejectOnAbort(init?.signal)
        } as Response)
      )
    )

    const res = createMockResponse()
    const request = routeHandler(quoteRequest(), res as any)

    await vi.advanceTimersByTimeAsync(8_000)
    await request

    expect(res.statusCode).toBe(504)
    expect(res.body).toEqual({ error: 'Enso route request timed out' })
  })

  it('maps balance upstream aborts to HTTP 504 without leaking upstream details', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
      )
    )

    const res = createMockResponse()
    const request = balancesHandler(balancesRequest(), res as any)

    await vi.advanceTimersByTimeAsync(6_000)
    await request

    expect(res.statusCode).toBe(504)
    expect(res.body).toEqual({ error: 'Enso balances request timed out' })
  })

  it('keeps the balance timeout active while reading the upstream body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string | URL | Request, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => rejectOnAbort(init?.signal)
        } as Response)
      )
    )

    const res = createMockResponse()
    const request = balancesHandler(balancesRequest(), res as any)

    await vi.advanceTimersByTimeAsync(6_000)
    await request

    expect(res.statusCode).toBe(504)
    expect(res.body).toEqual({ error: 'Enso balances request timed out' })
  })
})
