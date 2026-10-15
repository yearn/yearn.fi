import { GET_CORS_HEADERS, json, noContent, queryValue, WALLET_SCOPED_CACHE_CONTROL } from '../http'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
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

  try {
    const { getHoldingsBreakdown } = await import('../lib/holdings')
    const breakdown = await getHoldingsBreakdown(address, breakdownTimestamp ?? undefined)

    return json(breakdown, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
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
