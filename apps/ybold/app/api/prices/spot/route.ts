export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const YEARN_SPOT_PRICES_URL = 'https://yearn.fi/api/prices/spot'
const CACHE_CONTROL = 'public, s-maxage=120, stale-while-revalidate=600'
const MAX_SPOT_TOKENS = 50
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

function parseCoins(rawCoins: string | null): string[] {
  if (!rawCoins) {
    throw new Error('Missing coins query parameter')
  }

  const parsed = JSON.parse(rawCoins) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Coins payload must be an array')
  }
  if (parsed.length > MAX_SPOT_TOKENS) {
    throw new Error(`A maximum of ${MAX_SPOT_TOKENS} tokens is allowed`)
  }

  return parsed.map((coin) => {
    if (typeof coin !== 'string') {
      throw new Error('Each coin must be a token key string')
    }
    return coin
  })
}

function errorResponse(error: unknown): Response {
  return Response.json(
    { error: error instanceof Error ? error.message : 'Invalid coins query parameter' },
    { status: 400, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
  )
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const coins = (() => {
    try {
      return { value: parseCoins(requestUrl.searchParams.get('coins')) }
    } catch (error) {
      return { error }
    }
  })()
  if ('error' in coins) {
    return errorResponse(coins.error)
  }

  const upstreamUrl = new URL(YEARN_SPOT_PRICES_URL)
  upstreamUrl.searchParams.set(
    'coins',
    JSON.stringify([...new Set(coins.value)].sort((left, right) => left.localeCompare(right)))
  )

  const upstream = await fetch(upstreamUrl, { next: { revalidate: 120 } })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': upstream.ok ? CACHE_CONTROL : 'no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
    }
  })
}
