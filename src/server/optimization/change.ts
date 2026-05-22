import { GET_CORS_HEADERS, json, noContent, queryValue } from '../http'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './_lib/redis'

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'

function isHistoryQueryEnabled(historyParam: string | undefined): boolean {
  const value = historyParam
  return value === '1' || value === 'true'
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return json({ error: 'No optimization data available' }, { status: 404, headers: GET_CORS_HEADERS })
    }

    const requestedVault = queryValue(request, 'vault')
    if (requestedVault) {
      if (typeof requestedVault !== 'string') {
        return json({ error: 'Invalid vault parameter' }, { status: 400, headers: GET_CORS_HEADERS })
      }

      if (isHistoryQueryEnabled(queryValue(request, 'history') as string | undefined)) {
        const selectedHistory = optimizations.filter((optimization) => {
          return optimization.vault.toLowerCase() === requestedVault.toLowerCase()
        })
        if (selectedHistory.length === 0) {
          return json(
            { error: `Vault not found in optimization payload: ${requestedVault}` },
            { status: 404, headers: GET_CORS_HEADERS }
          )
        }

        return json(selectedHistory, { headers: { ...GET_CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } })
      }

      const selected = findVaultOptimization(optimizations, requestedVault)
      if (!selected) {
        return json(
          { error: `Vault not found in optimization payload: ${requestedVault}` },
          { status: 404, headers: GET_CORS_HEADERS }
        )
      }

      return json(selected, { headers: { ...GET_CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } })
    }

    return json(optimizations, { headers: { ...GET_CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } })
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
