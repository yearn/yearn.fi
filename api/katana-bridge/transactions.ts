import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'
import { normalizeKatanaBridgeTransactionsResponse } from '../../src/components/shared/utils/katanaBridge'

const POLYGON_TRANSACTIONS_API = 'https://api-gateway.polygon.technology/api/v3/transactions/mainnet'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userAddress } = req.query
  if (!userAddress || typeof userAddress !== 'string' || !isAddress(userAddress)) {
    return res.status(400).json({ error: 'Missing or invalid userAddress' })
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    console.error('POLYGON_API_KEY not configured')
    return res.status(503).json({ error: 'Katana bridge status API not configured' })
  }

  try {
    const upstreamUrl = `${POLYGON_TRANSACTIONS_API}?${new URLSearchParams({ userAddress })}`
    const response = await fetch(upstreamUrl, {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return res.status(response.status).json({
        error: 'Katana bridge status upstream error',
        status: response.status,
        details
      })
    }

    const payload = await response.json()

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(normalizeKatanaBridgeTransactionsResponse(payload))
  } catch (error) {
    console.error('Error proxying Katana bridge status request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
