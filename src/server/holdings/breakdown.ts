import { GET_CORS_HEADERS, getClientIdentifier, json, noContent, queryValue } from '../http'
import type { HoldingsEventFetchType, HoldingsEventPaginationMode, VaultVersion } from '../lib/holdings'
import { checkRateLimit, ensureHoldingsStorageInitialized } from '../lib/holdings'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseHoldingsEventFetchType(value: string | string[] | undefined): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | string[] | undefined): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

export function parseUtcDateParam(value: string | string[] | undefined): number | null {
  if (!value || Array.isArray(value)) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const utcDate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))

  if (
    utcDate.getUTCFullYear() !== yearNumber ||
    utcDate.getUTCMonth() !== monthNumber - 1 ||
    utcDate.getUTCDate() !== dayNumber
  ) {
    return null
  }

  const timestamp = Math.floor(utcDate.getTime() / 1000)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings breakdown storage initialization error:', error)
    return json({ error: 'Failed to initialize holdings storage' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  const clientId = getClientIdentifier(request)
  const rateCheck = await checkRateLimit(clientId)
  if (!rateCheck.allowed) {
    return json(
      { error: 'Too many requests', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { ...GET_CORS_HEADERS, 'Retry-After': String(rateCheck.retryAfter) } }
    )
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return json(
      {
        error: 'Holdings breakdown API not configured',
        details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
      },
      { status: 503, headers: GET_CORS_HEADERS }
    )
  }

  const address = queryValue(request, 'address')
  const dateParam = queryValue(request, 'date')
  const versionParam = queryValue(request, 'version')
  const fetchTypeParam = queryValue(request, 'fetchType')
  const paginationModeParam = queryValue(request, 'paginationMode')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const breakdownTimestamp = parseUtcDateParam(dateParam)
  if (dateParam && breakdownTimestamp === null) {
    return json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'
  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const paginationMode = parseHoldingsEventPaginationMode(paginationModeParam)

  try {
    const { getHoldingsBreakdown } = await import('../lib/holdings')
    const breakdown = await getHoldingsBreakdown(
      address,
      version,
      fetchType,
      paginationMode,
      breakdownTimestamp ?? undefined
    )

    return json(breakdown, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Holdings breakdown error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return json(
        {
          error: 'Failed to fetch holdings breakdown',
          message,
          stack
        },
        { status: 502, headers: GET_CORS_HEADERS }
      )
    }

    return json({ error: 'Failed to fetch holdings breakdown' }, { status: 502, headers: GET_CORS_HEADERS })
  }
}

export default GET
