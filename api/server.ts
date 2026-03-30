import { serve } from 'bun'
import {
  clearUserCache,
  getHistoricalHoldings,
  getHoldingsPnL,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  initializeSchema,
  type UnknownTransferInPnlMode,
  type VaultVersion,
  validateConfig
} from './lib/holdings'
import {
  createHoldingsDebugContext,
  debugError,
  debugLog,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from './lib/holdings/services/debug'

const ENSO_API_BASE = 'https://api.enso.finance'
const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

async function handleYvUsdAprs(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const requestUrl = new URL(req.url)
  const upstreamUrl = new URL(YVUSD_APR_SERVICE_API)
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value)
  })

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return Response.json(
        { error: 'yvUSD APR upstream error', status: response.status, details },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}

function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseUnknownTransferInPnlMode(value: string | null): UnknownTransferInPnlMode {
  return value === 'strict' || value === 'zero_basis' || value === 'windfall' ? value : 'windfall'
}

function parseHoldingsEventFetchType(value: string | null): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | null): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

function handleEnsoStatus(): Response {
  const apiKey = process.env.ENSO_API_KEY
  return Response.json({ configured: !!apiKey })
}

async function handleEnsoRoute(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const fromAddress = url.searchParams.get('fromAddress')
  const chainId = url.searchParams.get('chainId')
  const tokenIn = url.searchParams.get('tokenIn')
  const tokenOut = url.searchParams.get('tokenOut')
  const amountIn = url.searchParams.get('amountIn')
  const slippage = url.searchParams.get('slippage') || '100'
  const destinationChainId = url.searchParams.get('destinationChainId')
  const receiver = url.searchParams.get('receiver')

  if (!fromAddress || !chainId || !tokenIn || !tokenOut || !amountIn) {
    return Response.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return Response.json({ error: 'Enso API not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    fromAddress,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage
  })

  if (destinationChainId) {
    params.set('destinationChainId', destinationChainId)
  }
  if (receiver) {
    params.set('receiver', receiver)
  }

  const ensoUrl = `${ENSO_API_BASE}/api/v1/shortcuts/route?${params}`

  try {
    const response = await fetch(ensoUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json(data, { status: response.status })
    }

    return Response.json(data)
  } catch (error) {
    console.error('Error proxying Enso route request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleEnsoBalances(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const eoaAddress = url.searchParams.get('eoaAddress')
  const chainId = url.searchParams.get('chainId')

  if (!eoaAddress) {
    return Response.json({ error: 'Missing eoaAddress' }, { status: 400 })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return Response.json({ error: 'Enso API not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    eoaAddress,
    useEoa: 'true',
    chainId: chainId || 'all'
  })

  const ensoUrl = `${ENSO_API_BASE}/api/v1/wallet/balances?${params}`

  try {
    const response = await fetch(ensoUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Enso API error: ${response.status}`, errorText)
      return Response.json(
        { error: 'Enso API error', status: response.status, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Error proxying Enso request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleHoldingsHistory(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const refresh = url.searchParams.get('refresh') === '1'

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    if (refresh) {
      const cleared = await clearUserCache(address)
      console.log(`[Server] Cleared ${cleared} cached entries for ${address}`)
    }

    const holdings = await withHoldingsDebugContext(
      createHoldingsDebugContext('history', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings history request', {
          version,
          refresh,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHistoricalHoldings(address, version)
          debugLog('route', 'completed holdings history request', {
            version,
            refresh,
            points: response.dataPoints.length,
            nonZeroPoints: response.dataPoints.filter((point) => point.totalUsdValue > 0).length
          })
          return response
        } catch (error) {
          debugError('route', 'holdings history request failed', error, { version })
          throw error
        }
      }
    )

    const hasHoldings = holdings.dataPoints.some((dp) => dp.totalUsdValue > 0)
    if (!hasHoldings) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(
      {
        address: holdings.address,
        version,
        dataPoints: holdings.dataPoints.map((dp) => ({
          date: dp.date,
          value: dp.totalUsdValue
        }))
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching holdings history:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    // server.ts exists locally only, so it's ok to log the stack for debugging purposes
    return Response.json({ error: 'Failed to fetch historical holdings', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsPnL(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const unknownTransferInPnlMode = parseUnknownTransferInPnlMode(url.searchParams.get('unknownMode'))
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const pnl = await withHoldingsDebugContext(
      createHoldingsDebugContext('pnl', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings pnl request', {
          version,
          unknownTransferInPnlMode,
          fetchType,
          paginationMode,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHoldingsPnL(address, version, unknownTransferInPnlMode, fetchType, paginationMode)
          debugLog('route', 'completed holdings pnl request', {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            totalVaults: response.summary.totalVaults,
            totalCurrentValueUsd: response.summary.totalCurrentValueUsd,
            totalPnlUsd: response.summary.totalPnlUsd,
            totalEconomicGainUsd: response.summary.totalEconomicGainUsd
          })
          return response
        } catch (error) {
          debugError('route', 'holdings pnl request failed', error, {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode
          })
          throw error
        }
      }
    )

    if (pnl.summary.totalVaults === 0) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(pnl, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings PnL:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch holdings PnL', message, stack, status: 502 }, { status: 502 })
  }
}

async function main() {
  // Catch uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  })

  validateConfig()

  await initializeSchema()

  serve({
    async fetch(req) {
      const url = new URL(req.url)
      console.log(`[Server] ${req.method} ${url.pathname}`)

      try {
        if (req.method === 'OPTIONS') {
          return handleCorsPreFlight()
        }

        let response: Response

        if (url.pathname === '/api/enso/status') {
          response = handleEnsoStatus()
        } else if (url.pathname === '/api/enso/balances') {
          response = await handleEnsoBalances(req)
        } else if (url.pathname === '/api/enso/route') {
          response = await handleEnsoRoute(req)
        } else if (url.pathname === '/api/holdings/history') {
          response = await handleHoldingsHistory(req)
        } else if (url.pathname === '/api/holdings/pnl') {
          response = await handleHoldingsPnL(req)
        } else if (url.pathname === '/api/yvusd/aprs') {
          response = await handleYvUsdAprs(req)
        } else {
          response = new Response('Not found', { status: 404 })
        }

        return withCors(response)
      } catch (error) {
        console.error('💥 Request handler error:', error)
        return withCors(
          Response.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
            { status: 500 }
          )
        )
      }
    },
    port: 3001,
    idleTimeout: 120 // 2 minutes for long-running requests like historical holdings
  })

  console.log('🚀 API server running on http://localhost:3001')
  console.log('📊 Holdings API: http://localhost:3001/api/holdings/history?address=0x...')
  console.log('💹 PnL API: http://localhost:3001/api/holdings/pnl?address=0x...')
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
