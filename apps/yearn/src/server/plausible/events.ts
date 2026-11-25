import { getRequestIp } from '@/server/http'

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}

export async function POST(request: Request): Promise<Response> {
  const event: unknown = await request.json().catch(() => undefined)
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return new Response(null, { status: 400, headers: RESPONSE_HEADERS })
  }

  const headers = new Headers({ 'Content-Type': 'application/json' })
  const userAgent = request.headers.get('user-agent')
  const visitorIp = getRequestIp(request)
  if (userAgent) headers.set('User-Agent', userAgent)
  if (visitorIp) headers.set('X-Forwarded-For', visitorIp)

  const endpoint = new URL('https://plausible.io/api/event')
  endpoint.search = new URL(request.url).search

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000)
    })
    // Analytics needs only the status. Never serve vendor content or headers on our origin.
    await upstream.body?.cancel()
    return new Response(null, { status: upstream.status, headers: RESPONSE_HEADERS })
  } catch {
    return new Response(null, { status: 502, headers: RESPONSE_HEADERS })
  }
}
