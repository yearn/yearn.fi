import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ENSO_BALANCES_CACHE_CONTROL } from './cache'
import { checkEnsoRateLimit, isAbortError, withEnsoTimeout } from './guard'
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

    const result = await withEnsoTimeout(ENSO_BALANCES_TIMEOUT_MS, async (signal) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal
      })

      if (!response.ok) {
        const errorText = await response.text()

        return { errorText, response }
      }

      const data = await response.json()

      return { data, response }
    })

    if (!result.response.ok) {
      const errorText = 'errorText' in result ? result.errorText : ''
      console.error(`Enso API error: ${result.response.status}`, errorText)
      return res.status(result.response.status).json({
        error: 'Enso API error',
        status: result.response.status,
        details: errorText
      })
    }

    res.setHeader('Cache-Control', ENSO_BALANCES_CACHE_CONTROL)
    return res.status(200).json(result.data)
  } catch (error) {
    if (isAbortError(error)) {
      return res.status(504).json({ error: 'Enso balances request timed out' })
    }

    console.error('Error proxying Enso request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
