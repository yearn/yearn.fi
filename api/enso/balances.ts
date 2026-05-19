import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ENSO_BALANCES_CACHE_CONTROL } from './cache'

const ENSO_API_BASE = 'https://api.enso.finance'
const ENSO_BALANCES_PATH = '/api/v1/wallet/balances'
const ENSO_API_ORIGIN = new URL(ENSO_API_BASE).origin

function buildEnsoBalancesUrl(params: URLSearchParams): URL {
  const url = new URL(ENSO_BALANCES_PATH, ENSO_API_BASE)
  url.search = params.toString()

  if (url.protocol !== 'https:' || url.origin !== ENSO_API_ORIGIN || url.pathname !== ENSO_BALANCES_PATH) {
    throw new Error('Invalid Enso balances upstream URL')
  }

  return url
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { eoaAddress } = req.query

  if (!eoaAddress || typeof eoaAddress !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid eoaAddress' })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return res.status(500).json({ error: 'Enso API not configured' })
  }

  try {
    const params = new URLSearchParams({
      eoaAddress,
      useEoa: 'true',
      chainId: 'all'
    })

    const ensoUrl = buildEnsoBalancesUrl(params)

    const response = await fetch(ensoUrl, {
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

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
    console.error('Error proxying Enso request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
