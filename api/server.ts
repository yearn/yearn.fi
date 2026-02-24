import { serve } from 'bun'

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
    chainId: 'all'
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

serve({
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/api/enso/balances') {
      return handleEnsoBalances(req)
    }

    if (url.pathname === '/api/enso/route') {
      return handleEnsoRoute(req)
    }

    if (url.pathname === '/api/yvusd/aprs') {
      return handleYvUsdAprs(req)
    }

    return new Response('Not found', { status: 404 })
  },
  port: 3001
})

console.log('🚀 API server running on http://localhost:3001')
