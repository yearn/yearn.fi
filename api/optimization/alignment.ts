import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVaultDecimals } from './_lib/assetLogos'
import { OPTIMIZATION_GET_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import { fetchAlignedEvents } from './_lib/envio'
import { parseExplainMetadata } from './_lib/explain-parse'
import {
  findVaultOptimization,
  isAmbiguousVaultOptimizationError,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'
const ALIGNMENT_ERROR_MESSAGE = 'Unable to load optimization alignment'

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

  const vault = req.query.vault as string | undefined
  if (!vault) {
    return res.status(400).json({ error: 'vault parameter required' })
  }

  const requestedChainId = parseOptionalChainId(req.query.chainId)
  if (requestedChainId === null) {
    return res.status(400).json({ error: 'chainId must be a positive integer' })
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    console.error(ALIGNMENT_ERROR_MESSAGE, new Error('ENVIO_GRAPHQL_URL not configured'))
    return res.status(503).json({ error: ALIGNMENT_ERROR_MESSAGE })
  }

  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return res.status(404).json({ error: 'No optimization data available' })
    }

    const optimization = findVaultOptimization(optimizations, vault, requestedChainId)
    if (!optimization) {
      return res.status(404).json({ error: `Vault not found: ${vault}` })
    }

    let chainId = optimization.source.chainId
    if (!chainId) {
      const metadata = parseExplainMetadata(optimization.explain)
      chainId = metadata.chainId
    }
    if (!chainId) {
      return res.status(400).json({ error: 'Could not determine chain ID for vault' })
    }

    const timestampStr = optimization.source.latestMatchedTimestampUtc ?? optimization.source.timestampUtc
    if (!timestampStr) {
      return res.status(400).json({ error: 'No timestamp available for vault snapshot' })
    }
    const fromTs = Math.floor(new Date(timestampStr.replace(' UTC', 'Z').replace(' ', 'T')).getTime() / 1000)
    const numStrategies = optimization.strategyDebtRatios.length
    const toTs = fromTs + numStrategies * 10 * 60 * 2

    const decimals = getVaultDecimals(vault)

    const events = await fetchAlignedEvents(
      envioUrl,
      vault,
      chainId,
      optimization.strategyDebtRatios,
      fromTs,
      toTs,
      decimals
    )

    return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(events)
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return res.status(500).json({ error: REDIS_AUTHENTICATION_ERROR_MESSAGE })
    }

    if (isRedisConnectivityError(error)) {
      return res.status(503).json({ error: REDIS_CONNECTIVITY_ERROR_MESSAGE })
    }

    const message = error instanceof Error ? error.message : String(error)
    if (isAmbiguousVaultOptimizationError(error)) {
      return res.status(400).json({ error: message })
    }

    console.error(ALIGNMENT_ERROR_MESSAGE, error)
    return res.status(500).json({ error: ALIGNMENT_ERROR_MESSAGE })
  }
}
