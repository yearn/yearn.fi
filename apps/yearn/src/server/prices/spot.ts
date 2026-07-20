import { GET_CORS_HEADERS, json, noContent, queryString } from '@/server/http'
import { holdingsConfig } from '@/server/lib/holdings/config'

const SPOT_CACHE_CONTROL = 'public, s-maxage=120, stale-while-revalidate=600'
const CLIENT_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
const MAX_SPOT_TOKENS = 50

function parseCoins(rawCoins: string | undefined): string[] {
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

function buildUpstreamUrl(coins: string[]): string {
  const url = new URL(`${holdingsConfig.yearnPricesBaseUrl}/api/prices/spot`)
  url.searchParams.set('coins', JSON.stringify([...new Set(coins)].sort((left, right) => left.localeCompare(right))))
  return url.toString()
}

function responseHeaders(headers?: Headers): HeadersInit {
  return {
    ...GET_CORS_HEADERS,
    'Cache-Control': CLIENT_CACHE_CONTROL,
    'Vercel-CDN-Cache-Control': headers?.get('cache-control') || SPOT_CACHE_CONTROL
  }
}

export async function OPTIONS(): Promise<Response> {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const apiKey = holdingsConfig.yearnPricesApiKey
  if (!apiKey) {
    return json(
      { error: 'YEARN_PRICES_API_KEY or API_KEY_PORTFOLIO is not configured' },
      { status: 500, headers: { ...GET_CORS_HEADERS, 'Cache-Control': 'no-store' } }
    )
  }

  const parsedCoins = (() => {
    try {
      return { coins: parseCoins(queryString(request, 'coins')) }
    } catch (error) {
      return { error }
    }
  })()
  if ('error' in parsedCoins) {
    return json(
      { error: parsedCoins.error instanceof Error ? parsedCoins.error.message : 'Invalid coins query parameter' },
      { status: 400, headers: { ...GET_CORS_HEADERS, 'Cache-Control': 'no-store' } }
    )
  }

  const upstream = await fetch(buildUpstreamUrl(parsedCoins.coins), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    },
    next: { revalidate: 120 }
  })
  const rawBody = await upstream.text()
  const body = rawBody
    ? (() => {
        try {
          return JSON.parse(rawBody) as unknown
        } catch {
          return { error: rawBody }
        }
      })()
    : {}

  return json(body, {
    status: upstream.status,
    headers: upstream.ok ? responseHeaders(upstream.headers) : { ...GET_CORS_HEADERS, 'Cache-Control': 'no-store' }
  })
}
