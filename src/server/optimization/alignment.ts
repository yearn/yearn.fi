import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import { getVaultDecimals } from './_lib/assetLogos'
import { fetchAlignedEvents } from './_lib/envio'
import { parseExplainMetadata } from './_lib/explain-parse'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const vault = queryString(request, 'vault')
  if (!vault) {
    return json({ error: 'vault parameter required' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return json({ error: 'ENVIO_GRAPHQL_URL not configured' }, { status: 503, headers: GET_CORS_HEADERS })
  }

  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return json({ error: 'No optimization data available' }, { status: 404, headers: GET_CORS_HEADERS })
    }

    const optimization = findVaultOptimization(optimizations, vault)
    if (!optimization) {
      return json({ error: `Vault not found: ${vault}` }, { status: 404, headers: GET_CORS_HEADERS })
    }

    let chainId = optimization.source.chainId
    if (!chainId) {
      const metadata = parseExplainMetadata(optimization.explain)
      chainId = metadata.chainId
    }
    if (!chainId) {
      return json({ error: 'Could not determine chain ID for vault' }, { status: 400, headers: GET_CORS_HEADERS })
    }

    const timestampStr = optimization.source.latestMatchedTimestampUtc ?? optimization.source.timestampUtc
    if (!timestampStr) {
      return json({ error: 'No timestamp available for vault snapshot' }, { status: 400, headers: GET_CORS_HEADERS })
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

    return json(events, { headers: { ...GET_CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } })
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return json({ error: REDIS_AUTHENTICATION_ERROR_MESSAGE }, { status: 500, headers: GET_CORS_HEADERS })
    }

    if (isRedisConnectivityError(error)) {
      return json({ error: REDIS_CONNECTIVITY_ERROR_MESSAGE }, { status: 503, headers: GET_CORS_HEADERS })
    }

    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message }, { status: 500, headers: GET_CORS_HEADERS })
  }
}

export default GET
