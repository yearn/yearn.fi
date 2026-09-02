import { unstable_cache } from 'next/cache'
import { canonicalChains } from '@/config/chainDefinitions'
import { GET_CORS_HEADERS, json, noContent } from '@/server/http'
import { KONG_VAULT_LIST_URL } from '@/server/lib/aio'
import { getVercelCdnCacheHeaders } from '@/server/lib/cacheHeaders'
import type { TSiteHealth, TSiteHealthChain, TSiteHealthState } from '@/types/siteStatus'

const HEALTH_CHECK_TIMEOUT_MS = 4_000
const STATUS_DATA_CACHE_TTL_SECONDS = 30
const STATUS_CACHE_HEADERS = {
  ...GET_CORS_HEADERS,
  ...getVercelCdnCacheHeaders('public, s-maxage=30, stale-while-revalidate=30')
} as const

type TSiteHealthCache = {
  current?: Promise<TSiteHealth>
}

const siteHealthCache: TSiteHealthCache = {}

function normalizeTimestamp(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString()
}

function getRpcUrl(chain: (typeof canonicalChains)[number]): string {
  return process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chain.id}`]?.trim() || chain.rpcUrls.default.http[0] || ''
}

async function checkKong(): Promise<TSiteHealth['services']['kong']> {
  const startedAt = performance.now()
  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      method: 'HEAD',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    return {
      state: response.ok ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt),
      representationUpdatedAt: normalizeTimestamp(response.headers.get('last-modified'))
    }
  } catch {
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkRpc(chain: (typeof canonicalChains)[number]): Promise<TSiteHealthChain> {
  const startedAt = performance.now()
  const rpcUrl = getRpcUrl(chain)
  if (!rpcUrl) {
    return { chainId: chain.id, name: chain.name, state: 'unavailable', latencyMs: 0 }
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    const payload = (await response.json()) as { result?: string }
    const expectedChainId = `0x${chain.id.toString(16)}`
    return {
      chainId: chain.id,
      name: chain.name,
      state: response.ok && payload.result?.toLowerCase() === expectedChainId ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch {
    return {
      chainId: chain.id,
      name: chain.name,
      state: 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  }
}

function getRpcState(operational: number, total: number): TSiteHealthState {
  if (operational === total) {
    return 'operational'
  }
  if (operational > 0) {
    return 'degraded'
  }
  return 'unavailable'
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

async function checkSiteHealth(): Promise<TSiteHealth> {
  const [kong, chains] = await Promise.all([checkKong(), Promise.all(canonicalChains.map(checkRpc))])
  const operational = chains.filter((chain) => chain.state === 'operational').length
  const checkedAt = new Date().toISOString()

  return {
    checkedAt,
    generatedAt: new Date().toISOString(),
    builtAt: normalizeTimestamp(process.env.NEXT_PUBLIC_SITE_UPDATED_AT),
    services: {
      kong,
      rpc: {
        state: getRpcState(operational, chains.length),
        operational,
        total: chains.length,
        chains
      }
    }
  }
}

// Route handlers and server pages compile into separate bundles. A bound callback has the same
// serialized form in both, so the explicit key below resolves to one shared Next Data Cache entry.
const getDataCachedSiteHealth = unstable_cache(checkSiteHealth.bind(null), ['yearn-site-health-v1'], {
  revalidate: STATUS_DATA_CACHE_TTL_SECONDS,
  tags: ['site-health']
})

export function clearSiteHealthCache(): void {
  siteHealthCache.current = undefined
}

export function getSiteHealth(): Promise<TSiteHealth> {
  if (siteHealthCache.current) {
    return siteHealthCache.current
  }

  const value = getDataCachedSiteHealth()
  siteHealthCache.current = value
  const clearInFlight = (): void => {
    if (siteHealthCache.current === value) {
      siteHealthCache.current = undefined
    }
  }
  void value.then(clearInFlight, clearInFlight)
  return value
}

export async function GET(): Promise<Response> {
  return json(await getSiteHealth(), { headers: STATUS_CACHE_HEADERS })
}

export default GET
