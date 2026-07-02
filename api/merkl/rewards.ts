import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildMerklRewardsHeaders,
  buildMerklRewardsUrl,
  getMerklApiKey,
  MERKL_REWARDS_CACHE_CONTROL,
  validateMerklRewardsParams
} from './rewards.helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const validation = validateMerklRewardsParams(req.query.userAddress, req.query.chainId)
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error })
  }

  const apiKey = getMerklApiKey()
  if (!apiKey) {
    console.error('MERKL_API_KEY not configured')
    return res.status(500).json({ error: 'Merkl API not configured' })
  }

  try {
    const response = await fetch(buildMerklRewardsUrl(validation.params), {
      headers: buildMerklRewardsHeaders(apiKey)
    })
    const responseBody = await response.text()

    if (!response.ok) {
      console.error(`Merkl API error: ${response.status}`, responseBody)
      return res.status(response.status).json({
        error: 'Merkl API error',
        status: response.status,
        details: responseBody
      })
    }

    res.setHeader('Cache-Control', MERKL_REWARDS_CACHE_CONTROL)
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(responseBody)
  } catch (error) {
    console.error('Error proxying Merkl rewards request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
