import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import { getVercelCdnCacheHeaders } from '../lib/cacheHeaders'
import { fetchPendingTimelockStrategies } from '../lib/timelockStrategies/rpc'
import type { TPendingTimelockStrategiesResponse } from '../lib/timelockStrategies/types'

const TIMELOCK_STRATEGIES_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'
const RESPONSE_HEADERS = {
  ...GET_CORS_HEADERS,
  ...getVercelCdnCacheHeaders(TIMELOCK_STRATEGIES_CACHE_CONTROL)
}
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

function parseChainId(value: string | undefined): number | null {
  const parsed = value ? Number(value) : Number.NaN

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseVaultAddress(value: string | undefined): `0x${string}` | null {
  return value && ADDRESS_PATTERN.test(value) ? (value as `0x${string}`) : null
}

export async function buildVaultTimelockStrategiesResponse(params: {
  chainId: number
  vaultAddress: `0x${string}`
}): Promise<TPendingTimelockStrategiesResponse> {
  const items = await fetchPendingTimelockStrategies({
    chainId: params.chainId,
    vaultAddress: params.vaultAddress
  })

  return {
    chainId: params.chainId,
    vaultAddress: params.vaultAddress,
    generatedAt: Math.floor(Date.now() / 1000),
    items
  }
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const chainId = parseChainId(queryString(request, 'chainId'))
  if (chainId === null) {
    return json({ error: 'chainId parameter required' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const vaultAddress = parseVaultAddress(queryString(request, 'vault'))
  if (vaultAddress === null) {
    return json({ error: 'valid vault parameter required' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const payload = await buildVaultTimelockStrategiesResponse({ chainId, vaultAddress })

  return json(payload, {
    headers: RESPONSE_HEADERS
  })
}

export default GET
