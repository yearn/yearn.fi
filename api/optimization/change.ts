import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OPTIMIZATION_GET_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import {
  findVaultOptimization,
  isAmbiguousVaultOptimizationError,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'
const CHANGE_ERROR_MESSAGE = 'Unable to load optimization changes'

function isHistoryQueryEnabled(historyParam: string | string[] | undefined): boolean {
  const value = Array.isArray(historyParam) ? historyParam[0] : historyParam
  return value === '1' || value === 'true'
}

function parseOptionalChainId(chainIdParam: string | string[] | undefined): number | undefined | null {
  const value = Array.isArray(chainIdParam) ? chainIdParam[0] : chainIdParam
  if (value === undefined) {
    return undefined
  }

  const chainId = Number.parseInt(value, 10)
  return /^\d+$/.test(value) && Number.isSafeInteger(chainId) && chainId > 0 ? chainId : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_GET_CORS_HEADERS, req.headers.origin)

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
      const requestedChainId = parseOptionalChainId(req.query.chainId)
      if (requestedChainId === null) {
        return res.status(400).json({ error: 'chainId must be a positive integer' })
      }

      if (isHistoryQueryEnabled(req.query.history)) {
        const selectedHistory = optimizations.filter((optimization) => {
          return (
            optimization.vault.toLowerCase() === requestedVault.toLowerCase() &&
            (requestedChainId === undefined || optimization.source.chainId === requestedChainId)
          )
        })
        const matchedChainIds = new Set(selectedHistory.map((optimization) => optimization.source.chainId))
        if (requestedChainId === undefined && matchedChainIds.size > 1) {
          return res.status(400).json({
            error: `Vault matches optimization records on multiple chains; provide chainId: ${requestedVault}`
          })
        }
        if (selectedHistory.length === 0) {
          return res.status(404).json({ error: `Vault not found in optimization payload: ${requestedVault}` })
        }

        return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(selectedHistory)
      }

      const selected = findVaultOptimization(optimizations, requestedVault, requestedChainId)
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
    if (isAmbiguousVaultOptimizationError(error)) {
      return res.status(400).json({ error: message })
    }

    console.error(CHANGE_ERROR_MESSAGE, error)
    return res.status(500).json({ error: CHANGE_ERROR_MESSAGE })
  }
}
