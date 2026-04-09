const ENSO_API_BASE = 'https://api.enso.finance'

export type TApiHandlerResult = {
  body: unknown
  headers?: HeadersInit
  status: number
}

function getEnsoApiKey(): string | null {
  return process.env.ENSO_API_KEY ?? null
}

async function parseUpstreamResponse(response: Response): Promise<unknown> {
  const responseText = await response.text()

  if (!responseText) {
    return null
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return responseText
  }
}

export function getEnsoStatusResult(): TApiHandlerResult {
  return {
    status: 200,
    body: { configured: !!getEnsoApiKey() }
  }
}

export async function getEnsoBalancesResult(searchParams: URLSearchParams): Promise<TApiHandlerResult> {
  const eoaAddress = searchParams.get('eoaAddress')

  if (!eoaAddress) {
    return {
      status: 400,
      body: { error: 'Missing or invalid eoaAddress' }
    }
  }

  const apiKey = getEnsoApiKey()
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return {
      status: 500,
      body: { error: 'Enso API not configured' }
    }
  }

  const upstreamSearchParams = new URLSearchParams({
    eoaAddress,
    useEoa: 'true',
    chainId: 'all'
  })

  try {
    const response = await fetch(`${ENSO_API_BASE}/api/v1/wallet/balances?${upstreamSearchParams}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const details = await response.text()
      console.error(`Enso API error: ${response.status}`, details)
      return {
        status: response.status,
        body: {
          error: 'Enso API error',
          status: response.status,
          details
        }
      }
    }

    return {
      status: 200,
      body: await response.json(),
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    }
  } catch (error) {
    console.error('Error proxying Enso balances request:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}

export async function getEnsoRouteResult(searchParams: URLSearchParams): Promise<TApiHandlerResult> {
  const fromAddress = searchParams.get('fromAddress')
  const chainId = searchParams.get('chainId')
  const tokenIn = searchParams.get('tokenIn')
  const tokenOut = searchParams.get('tokenOut')
  const amountIn = searchParams.get('amountIn')
  const slippage = searchParams.get('slippage') || '100'
  const destinationChainId = searchParams.get('destinationChainId')
  const receiver = searchParams.get('receiver')

  if (!fromAddress) {
    return { status: 400, body: { error: 'Missing or invalid fromAddress' } }
  }
  if (!chainId) {
    return { status: 400, body: { error: 'Missing or invalid chainId' } }
  }
  if (!tokenIn) {
    return { status: 400, body: { error: 'Missing or invalid tokenIn' } }
  }
  if (!tokenOut) {
    return { status: 400, body: { error: 'Missing or invalid tokenOut' } }
  }
  if (!amountIn) {
    return { status: 400, body: { error: 'Missing or invalid amountIn' } }
  }

  const apiKey = getEnsoApiKey()
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return {
      status: 500,
      body: { error: 'Enso API not configured' }
    }
  }

  const upstreamSearchParams = new URLSearchParams({
    fromAddress,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage
  })

  if (destinationChainId) {
    upstreamSearchParams.set('destinationChainId', destinationChainId)
  }
  if (receiver) {
    upstreamSearchParams.set('receiver', receiver)
  }

  try {
    const response = await fetch(`${ENSO_API_BASE}/api/v1/shortcuts/route?${upstreamSearchParams}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    return {
      status: response.status,
      body: await parseUpstreamResponse(response)
    }
  } catch (error) {
    console.error('Error proxying Enso route request:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}
