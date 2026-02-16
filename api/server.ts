import { serve } from 'bun'
import { clearCache, getHistoricalHoldings, initializeSchema, isDatabaseEnabled, validateConfig } from './lib/holdings'

const ENSO_API_BASE = 'https://api.enso.finance'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

function handleCorsPrelight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function handleEnsoStatus(): Response {
  const apiKey = process.env.ENSO_API_KEY
  const isConfigured = !!apiKey
  return Response.json({ configured: isConfigured })
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
  const refresh = url.searchParams.get('refresh')

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  try {
    if (refresh === 'true') {
      await clearCache(address)
    }

    const holdings = await getHistoricalHoldings(address)

    const hasHoldings = holdings.dataPoints.some((dp) => dp.totalUsdValue > 0)
    if (!hasHoldings) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(holdings, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings history:', error)
    return Response.json({ error: 'Failed to fetch historical holdings', status: 502 }, { status: 502 })
  }
}

async function handleHoldingsHistorySimple(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const refresh = url.searchParams.get('refresh')

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  try {
    if (refresh === 'true') {
      await clearCache(address)
    }

    const holdings = await getHistoricalHoldings(address)

    const hasHoldings = holdings.dataPoints.some((dp) => dp.totalUsdValue > 0)
    if (!hasHoldings) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(
      {
        address: holdings.address,
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
    return Response.json({ error: 'Failed to fetch historical holdings', status: 502 }, { status: 502 })
  }
}

async function handleHoldingsCacheClear(req: Request): Promise<Response> {
  if (req.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  try {
    if (address) {
      if (!isValidAddress(address)) {
        return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
      }
      await clearCache(address)
      return Response.json({ message: `Cache cleared for ${address}` })
    }

    await clearCache()
    return Response.json({ message: 'All cache cleared' })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return Response.json({ error: 'Failed to clear cache', status: 500 }, { status: 500 })
  }
}

async function handleHealth(): Promise<Response> {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDatabaseEnabled() ? 'enabled' : 'disabled'
  })
}

async function main() {
  validateConfig()

  await initializeSchema()

  serve({
    async fetch(req) {
      const url = new URL(req.url)

      if (req.method === 'OPTIONS') {
        return handleCorsPrelight()
      }

      let response: Response

      if (url.pathname === '/api/enso/status') {
        response = handleEnsoStatus()
      } else if (url.pathname === '/api/enso/balances') {
        response = await handleEnsoBalances(req)
      } else if (url.pathname === '/api/enso/route') {
        response = await handleEnsoRoute(req)
      } else if (url.pathname === '/api/v1/health') {
        response = await handleHealth()
      } else if (url.pathname === '/api/v1/holdings/history/simple') {
        response = await handleHoldingsHistorySimple(req)
      } else if (url.pathname === '/api/v1/holdings/history') {
        response = await handleHoldingsHistory(req)
      } else if (url.pathname === '/api/v1/holdings/cache') {
        response = await handleHoldingsCacheClear(req)
      } else {
        response = new Response('Not found', { status: 404 })
      }

      return withCors(response)
    },
    port: 3001
  })

  console.log('🚀 API server running on http://localhost:3001')
  console.log('📊 Holdings API: http://localhost:3001/api/v1/holdings/history?address=0x...')
  console.log('📈 Simple API: http://localhost:3001/api/v1/holdings/history/simple?address=0x...')
  console.log('💚 Health: http://localhost:3001/api/v1/health')
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
