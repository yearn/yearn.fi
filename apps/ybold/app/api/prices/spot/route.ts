export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const YEARN_SPOT_PRICES_URL = 'https://yearn.fi/api/prices/spot'
const CACHE_CONTROL = 'public, s-maxage=120, stale-while-revalidate=600'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const upstreamUrl = new URL(YEARN_SPOT_PRICES_URL)
  upstreamUrl.searchParams.set('coins', requestUrl.searchParams.get('coins') ?? '')

  const upstream = await fetch(upstreamUrl, { next: { revalidate: 120 } })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': CACHE_CONTROL,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
    }
  })
}
