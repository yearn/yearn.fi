import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearCache, getHistoricalHoldings } from '../lib/holdings'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { address, refresh } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  try {
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
    console.error('Error fetching holdings history:', error)
    return res.status(502).json({ error: 'Failed to fetch historical holdings' })
  }
}
