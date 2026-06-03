import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVercelCdnCacheHeaders } from '../lib/cacheHeaders'
import { fetchPendingTimelockStrategies } from '../lib/timelockStrategies/rpc'
import type { TPendingTimelockStrategiesResponse } from '../lib/timelockStrategies/types'

const TIMELOCK_STRATEGIES_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

function parseChainId(value: string | null | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsed = rawValue ? Number(rawValue) : Number.NaN

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseVaultAddress(value: string | null | string[] | undefined): `0x${string}` | null {
  const rawValue = Array.isArray(value) ? value[0] : value

  return rawValue && ADDRESS_PATTERN.test(rawValue) ? (rawValue as `0x${string}`) : null
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

export async function handleVaultTimelockStrategiesRequest(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url = new URL(req.url)
  const chainId = parseChainId(url.searchParams.get('chainId'))
  if (chainId === null) {
    return Response.json({ error: 'chainId parameter required' }, { status: 400 })
  }

  const vaultAddress = parseVaultAddress(url.searchParams.get('vault'))
  if (vaultAddress === null) {
    return Response.json({ error: 'valid vault parameter required' }, { status: 400 })
  }

  const payload = await buildVaultTimelockStrategiesResponse({ chainId, vaultAddress })

  return Response.json(payload, {
    headers: getVercelCdnCacheHeaders(TIMELOCK_STRATEGIES_CACHE_CONTROL)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const chainId = parseChainId(req.query.chainId)
  if (chainId === null) {
    res.status(400).json({ error: 'chainId parameter required' })
    return
  }

  const vaultAddress = parseVaultAddress(req.query.vault)
  if (vaultAddress === null) {
    res.status(400).json({ error: 'valid vault parameter required' })
    return
  }

  const payload = await buildVaultTimelockStrategiesResponse({ chainId, vaultAddress })
  Object.entries(getVercelCdnCacheHeaders(TIMELOCK_STRATEGIES_CACHE_CONTROL)).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  res.status(200).json(payload)
}
