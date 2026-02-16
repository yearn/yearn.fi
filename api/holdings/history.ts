import type { VercelRequest, VercelResponse } from '@vercel/node'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if Envio is configured
  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return res.status(503).json({
      error: 'Holdings history API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const { address, refresh } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  try {
    // Dynamic import to catch any module loading errors
    const { clearCache, getHistoricalHoldings } = await import('../lib/holdings')

    if (refresh === 'true') {
      await clearCache(address)
    }

    const holdings = await getHistoricalHoldings(address)

    const hasHoldings = holdings.dataPoints.some((dp) => dp.totalUsdValue > 0)
    if (!hasHoldings) {
      return res.status(404).json({ error: 'No holdings found for address' })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      address: holdings.address,
      dataPoints: holdings.dataPoints.map((dp) => ({
        date: dp.date,
        value: dp.totalUsdValue
      }))
    })
  } catch (error) {
    console.error('Holdings history error:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return res.status(502).json({
      error: 'Failed to fetch historical holdings',
      message,
      envioUrl: envioUrl ? 'configured' : 'not configured',
      stack: process.env.NODE_ENV === 'development' ? stack : undefined
    })
  }
}
