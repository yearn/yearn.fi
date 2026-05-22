import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'

const ENSO_API_BASE = 'https://api.enso.finance'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const fromAddress = queryString(request, 'fromAddress')
  const chainId = queryString(request, 'chainId')
  const tokenIn = queryString(request, 'tokenIn')
  const tokenOut = queryString(request, 'tokenOut')
  const amountIn = queryString(request, 'amountIn')
  const slippage = queryString(request, 'slippage')
  const routingStrategy = queryString(request, 'routingStrategy')
  const destinationChainId = queryString(request, 'destinationChainId')
  const receiver = queryString(request, 'receiver')

  if (!fromAddress) {
    return json({ error: 'Missing or invalid fromAddress' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!chainId) {
    return json({ error: 'Missing or invalid chainId' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!tokenIn) {
    return json({ error: 'Missing or invalid tokenIn' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!tokenOut) {
    return json({ error: 'Missing or invalid tokenOut' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!amountIn) {
    return json({ error: 'Missing or invalid amountIn' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return json({ error: 'Enso API not configured' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  try {
    const params = new URLSearchParams({
      fromAddress,
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      slippage: (slippage as string) || '100'
    })

    if (destinationChainId) {
      params.set('destinationChainId', destinationChainId)
    }
    if (receiver) {
      params.set('receiver', receiver)
    }
    if (routingStrategy) {
      params.set('routingStrategy', routingStrategy)
    }

    const url = `${ENSO_API_BASE}/api/v1/shortcuts/route?${params}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return json(data, { status: response.status, headers: GET_CORS_HEADERS })
    }

    return json(data, { headers: GET_CORS_HEADERS })
  } catch (error) {
    console.error('Error proxying Enso route request:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
  }
}

export default GET
