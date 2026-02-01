import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENSO_API_BASE = 'https://api.enso.finance'

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

    const url = `${ENSO_API_BASE}/api/v1/wallet/balances?${params}`

    const response = await fetch(url, {
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

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(data)
  } catch (error) {
    console.error('Error proxying Enso request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
