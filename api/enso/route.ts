import type { VercelRequest, VercelResponse } from '@vercel/node'
import { normalizeEnsoRouteResponse } from '../../src/components/pages/vaults/hooks/solvers/ensoRoute'
import { checkEnsoRateLimit, isAbortError, withEnsoTimeout } from './guard'
import { validateEnsoQuoteQuery } from './validation'

const ENSO_API_BASE = 'https://api.enso.finance'
const ENSO_ROUTE_RATE_LIMIT = 30
const ENSO_ROUTE_TIMEOUT_MS = 8_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rateLimit = checkEnsoRateLimit(req, 'route', ENSO_ROUTE_RATE_LIMIT)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter))
    return res.status(429).json({ error: 'Too many Enso route requests' })
  }

  const validated = validateEnsoQuoteQuery(req.query)
  if (!validated.ok) {
    return res.status(400).json({ error: validated.error })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return res.status(500).json({ error: 'Enso API not configured' })
  }

  try {
    const {
      fromAddress,
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      routingStrategy,
      destinationChainId,
      receiver
    } = validated.value
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
    if (routingStrategy) {
      params.set('routingStrategy', routingStrategy)
    }

    const url = `${ENSO_API_BASE}/api/v1/shortcuts/route?${params}`

    const { data, response } = await withEnsoTimeout(ENSO_ROUTE_TIMEOUT_MS, async (signal) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal
      })
      const data = await response.json()

      return { data, response }
    })

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    const parsedChainId = Number(chainId)
    const normalizedResponse = normalizeEnsoRouteResponse(
      data,
      response.status,
      Number.isFinite(parsedChainId) ? parsedChainId : undefined
    )

    if (normalizedResponse.error) {
      return res.status(normalizedResponse.error.statusCode).json(normalizedResponse.error)
    }

    return res.status(200).json(normalizedResponse.route)
  } catch (error) {
    if (isAbortError(error)) {
      return res.status(504).json({ error: 'Enso route request timed out' })
    }

    console.error('Error proxying Enso route request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
