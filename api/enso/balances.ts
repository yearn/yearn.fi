import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ENSO_BALANCES_CACHE_CONTROL } from './cache'
import { checkEnsoRateLimit, fetchWithEnsoTimeout, isAbortError } from './guard'
import { validateEnsoBalancesQuery } from './validation'

const ENSO_API_BASE = 'https://api.enso.finance'
const ENSO_BALANCES_RATE_LIMIT = 20
const ENSO_BALANCES_TIMEOUT_MS = 6_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rateLimit = checkEnsoRateLimit(req, 'balances', ENSO_BALANCES_RATE_LIMIT)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter))
    return res.status(429).json({ error: 'Too many Enso balance requests' })
  }

  const validated = validateEnsoBalancesQuery(req.query)
  if (!validated.ok) {
    return res.status(400).json({ error: validated.error })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return res.status(500).json({ error: 'Enso API not configured' })
  }

  try {
    const { eoaAddress } = validated.value
    const params = new URLSearchParams({
      eoaAddress,
      useEoa: 'true',
      chainId: 'all'
    })

    const url = `${ENSO_API_BASE}/api/v1/wallet/balances?${params}`

    const response = await fetchWithEnsoTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      ENSO_BALANCES_TIMEOUT_MS
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Enso API error: ${response.status}`, errorText)
      return res.status(response.status).json({
        error: 'Enso API error',
        status: response.status,
        details: errorText
      })
    }

    const data = await response.json()

    res.setHeader('Cache-Control', ENSO_BALANCES_CACHE_CONTROL)
    return res.status(200).json(data)
  } catch (error) {
    if (isAbortError(error)) {
      return res.status(504).json({ error: 'Enso balances request timed out' })
    }

    console.error('Error proxying Enso request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
