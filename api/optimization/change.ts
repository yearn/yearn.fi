import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).send(null)
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return res.status(404).json({ error: 'No optimization data available' })
    }

    const requestedVault = req.query.vault as string | undefined
    if (requestedVault) {
      const selected = findVaultOptimization(optimizations, requestedVault)
      if (!selected) {
        return res.status(404).json({ error: `Vault not found in optimization payload: ${requestedVault}` })
      }

      return res
        .status(200)
        .setHeader('Cache-Control', CACHE_CONTROL)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json(selected)
    }

    return res
      .status(200)
      .setHeader('Cache-Control', CACHE_CONTROL)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json(optimizations)
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return res.status(500).json({
        error:
          'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_USERNAME and UPSTASH_REDIS_REST_TOKEN credentials.'
      })
    }

    if (isRedisConnectivityError(error)) {
      return res.status(503).json({
        error: 'Backend connectivity unavailable. Unable to access Redis.'
      })
    }

    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: message })
  }
}
