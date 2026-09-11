import { GET_CORS_HEADERS, json, noContent, queryValue, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'
import type {
  HoldingsEventFetchType,
  HoldingsHistoryDenomination,
  HoldingsHistoryTimeframe,
  VaultVersion
} from '@/server/lib/holdings'
import { ensureHoldingsStorageInitialized } from '@/server/lib/holdings'
import {
  createHoldingsDebugContext,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseHoldingsEventFetchType(value: string | string[] | undefined): HoldingsEventFetchType {
  return value === 'seq' ? 'seq' : 'parallel'
}

function parseHoldingsHistoryDenomination(value: string | string[] | undefined): HoldingsHistoryDenomination {
  return value === 'eth' ? 'eth' : 'usd'
}

function parseHoldingsHistoryTimeframe(value: string | string[] | undefined): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings portfolio storage initialization error:', error)
    return json({ error: 'Failed to initialize holdings storage' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  if (!process.env.ENVIO_GRAPHQL_URL) {
    return json(
      {
        error: 'Holdings portfolio API not configured',
        details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
      },
      { status: 503, headers: GET_CORS_HEADERS }
    )
  }

  const address = queryValue(request, 'address')
  const versionParam = queryValue(request, 'version')
  const denominationParam = queryValue(request, 'denomination')
  const timeframeParam = queryValue(request, 'timeframe')
  const fetchTypeParam = queryValue(request, 'fetchType')
  const debugParam = queryValue(request, 'debug')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'
  const denomination = parseHoldingsHistoryDenomination(denominationParam)
  const timeframe = parseHoldingsHistoryTimeframe(timeframeParam)
  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const debugEnabled = isHoldingsDebugRequested(typeof debugParam === 'string' ? debugParam : null)

  try {
    const { getHoldingsPortfolio } = await import('../lib/holdings')
    const portfolio = await withHoldingsDebugContext(
      createHoldingsDebugContext('portfolio', address, debugEnabled),
      () => getHoldingsPortfolio(address, version, fetchType, 'paged', denomination, timeframe)
    )

    return json(portfolio, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Holdings portfolio error:', error)

    if (process.env.NODE_ENV === 'development') {
      return json(
        {
          error: 'Failed to fetch holdings portfolio',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 502, headers: GET_CORS_HEADERS }
      )
    }

    return json({ error: 'Failed to fetch holdings portfolio' }, { status: 502, headers: GET_CORS_HEADERS })
  }
}

export default GET
