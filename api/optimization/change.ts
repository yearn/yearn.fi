import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OPTIMIZATION_GET_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_GET_CORS_HEADERS)

  if (req.method === 'OPTIONS') {
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

      return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(selected)
    }

    return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(optimizations)
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return res.status(500).json({
        error: REDIS_AUTHENTICATION_ERROR_MESSAGE
      })
    }

    if (isRedisConnectivityError(error)) {
      return res.status(503).json({
        error: REDIS_CONNECTIVITY_ERROR_MESSAGE
      })
    }

    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: message })
  }
}
