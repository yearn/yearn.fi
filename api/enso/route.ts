import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENSO_API_BASE = 'https://api.enso.finance'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fromAddress, chainId, tokenIn, tokenOut, amountIn, slippage, destinationChainId, receiver } = req.query

  if (!fromAddress || typeof fromAddress !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid fromAddress' })
  }
  if (!chainId || typeof chainId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chainId' })
  }
  if (!tokenIn || typeof tokenIn !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid tokenIn' })
  }
  if (!tokenOut || typeof tokenOut !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid tokenOut' })
  }
  if (!amountIn || typeof amountIn !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid amountIn' })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return res.status(500).json({ error: 'Enso API not configured' })
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

    if (destinationChainId && typeof destinationChainId === 'string') {
      params.set('destinationChainId', destinationChainId)
    }
    if (receiver && typeof receiver === 'string') {
      params.set('receiver', receiver)
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
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Error proxying Enso route request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
