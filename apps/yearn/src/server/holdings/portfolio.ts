import { GET_CORS_HEADERS, json, noContent, queryValue, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'
import type { HoldingsHistoryDenomination, HoldingsHistoryTimeframe } from '@/server/lib/holdings'
import {
  createHoldingsDebugContext,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import { startHoldingsProgress, updateHoldingsProgress } from '@/server/lib/holdings/services/progress'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
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
  const denominationParam = queryValue(request, 'denomination')
  const timeframeParam = queryValue(request, 'timeframe')
  const debugParam = queryValue(request, 'debug')
  const progressIdParam = queryValue(request, 'progressId')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const denomination = parseHoldingsHistoryDenomination(denominationParam)
  const timeframe = parseHoldingsHistoryTimeframe(timeframeParam)
  const debugEnabled = isHoldingsDebugRequested(typeof debugParam === 'string' ? debugParam : null)
  const progressId = typeof progressIdParam === 'string' ? progressIdParam : null

  try {
    const activeProgressId = await startHoldingsProgress({
      id: progressId,
      route: 'portfolio',
      address,
      message: 'Checking saved portfolio history'
    })
    const { getHoldingsPortfolio } = await import('../lib/holdings')
    const portfolio = await withHoldingsDebugContext(
      createHoldingsDebugContext('portfolio', address, debugEnabled),
      () => getHoldingsPortfolio(address, denomination, timeframe, activeProgressId)
    )
    await updateHoldingsProgress(activeProgressId, {
      status: 'complete',
      progress: 100,
      message: 'Portfolio history ready',
      detail: null
    })

    return json(portfolio, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
      }
    })
  } catch (error) {
    await updateHoldingsProgress(progressId, {
      status: 'error',
      message: 'Failed to build portfolio history',
      detail: error instanceof Error ? error.message : String(error)
    })
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
