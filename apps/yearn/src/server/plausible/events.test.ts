import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/server/plausible/events'

const EVENT = {
  n: 'pageview',
  u: 'https://yearn.fi/vaults?utm_source=test',
  d: 'yearn.fi',
  r: 'https://example.com/',
  p: { app: 'yearn' }
}

function eventRequest(body = JSON.stringify(EVENT), headers: Record<string, string> = {}): Request {
  return new Request('https://yearn.fi/proxy/plausible/api/event?probe=1', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': 'Browser analytics test',
      'X-Forwarded-For': '203.0.113.42, 10.0.0.1',
      Cookie: 'session=must-not-be-forwarded',
      Authorization: 'Bearer must-not-be-forwarded',
      ...headers
    }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Plausible event relay', () => {
  it.each(['pageview', 'wallet_picker_open'])('preserves %s events and visitor attribution', async (name) => {
    const fetchStub = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }))
    vi.stubGlobal('fetch', fetchStub)
    const event = { ...EVENT, n: name }

    const response = await POST(eventRequest(JSON.stringify(event)))

    expect(fetchStub).toHaveBeenCalledOnce()
    const [url, options] = fetchStub.mock.calls[0]
    expect(String(url)).toBe('https://plausible.io/api/event?probe=1')
    expect(JSON.parse(options.body)).toEqual(event)
    expect(Object.fromEntries(options.headers)).toEqual({
      'content-type': 'application/json',
      'user-agent': 'Browser analytics test',
      'x-forwarded-for': '203.0.113.42'
    })
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' })
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(response.status).toBe(202)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('')
  })

  it('falls back to the visitor IP supplied as x-real-ip', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchStub)

    await POST(eventRequest(JSON.stringify(EVENT), { 'X-Forwarded-For': '', 'X-Real-IP': '203.0.113.43' }))

    expect(fetchStub.mock.calls[0][1].headers.get('x-forwarded-for')).toBe('203.0.113.43')
  })

  it.each(['application/javascript', 'text/html'])('discards upstream %s content and headers', async (contentType) => {
    const upstream = new Response('<script>globalThis.untrusted = true</script>', {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Set-Cookie': 'untrusted=true',
        Location: 'https://attacker.example/',
        'Cache-Control': 'public, max-age=86400'
      }
    })
    const cancel = vi.spyOn(upstream.body!, 'cancel')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream))

    const response = await POST(eventRequest())

    expect(cancel).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(null)
    expect(response.headers.get('Set-Cookie')).toBe(null)
    expect(response.headers.get('Location')).toBe(null)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    await expect(response.text()).resolves.toBe('')
  })

  it.each(['not-json', 'null', '[]', '"not an event"'])('rejects invalid event payload %s', async (body) => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)

    const response = await POST(eventRequest(body))

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toBe('')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('preserves an upstream error status without its response content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('untrusted error details', { status: 429 })))

    const response = await POST(eventRequest())

    expect(response.status).toBe(429)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('')
  })

  it('returns an empty gateway error on network or redirect failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('upstream failed')))

    const response = await POST(eventRequest())

    expect(response.status).toBe(502)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('')
  })
})
