import { unstable_cache } from 'next/cache'
import { canonicalChains } from '@/config/chainDefinitions'
import { GET_CORS_HEADERS, json, noContent } from '@/server/http'
import { KONG_VAULT_LIST_URL } from '@/server/lib/aio'
import { getVercelCdnCacheHeaders } from '@/server/lib/cacheHeaders'
import { holdingsConfig } from '@/server/lib/holdings/config'
import type { TSiteHealth, TSiteHealthChain, TSiteHealthService, TSiteHealthState } from '@/types/siteStatus'

const HEALTH_CHECK_TIMEOUT_MS = 4_000
const STATUS_DATA_CACHE_TTL_SECONDS = 30
const PRICE_COIN = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const ENSO_NETWORKS_URL = 'https://api.enso.build/api/v1/networks'
const CMS_URL = 'https://cms.yearn.fi'
const TOKEN_ASSETS_URL = 'https://token-assets.yearn.fi'
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

async function checkPrices(): Promise<TSiteHealth['services']['prices']> {
  const startedAt = performance.now()
  const apiKey = holdingsConfig.yearnPricesApiKey
  if (!apiKey) {
    return { state: 'unavailable', latencyMs: 0 }
  }

  try {
    const url = new URL(`${holdingsConfig.yearnPricesBaseUrl}/api/prices/spot`)
    url.searchParams.set('coins', JSON.stringify([PRICE_COIN]))
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    const payload = (await response.json()) as { coins?: Record<string, { prices?: Array<{ price?: number }> }> }
    const hasPrice = payload.coins?.[PRICE_COIN]?.prices?.some(
      ({ price }) => Number.isFinite(price) && Number(price) > 0
    )

    return {
      state: response.ok && hasPrice ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch {
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkPortfolio(): Promise<TSiteHealth['services']['portfolio']> {
  const startedAt = performance.now()
  const url = process.env.ENVIO_GRAPHQL_URL?.trim()
  if (!url) {
    return { state: 'unavailable', latencyMs: 0 }
  }

  const password = holdingsConfig.envioPassword
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (password && password !== 'testing') {
    headers['x-hasura-admin-secret'] = password
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: 'query Status { Deposit(limit: 1) { id } }' }),
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    const payload = (await response.json()) as { data?: { Deposit?: unknown[] }; errors?: unknown[] }

    return {
      state: response.ok && Array.isArray(payload.data?.Deposit) && !payload.errors ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch {
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkTransactions(): Promise<TSiteHealth['services']['transactions']> {
  const startedAt = performance.now()
  const apiKey = process.env.ENSO_API_KEY?.trim()
  if (!apiKey) {
    return { state: 'unavailable', latencyMs: 0 }
  }

  try {
    const response = await fetch(ENSO_NETWORKS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    const payload = (await response.json()) as unknown

    return {
      state: response.ok && Array.isArray(payload) && payload.length > 0 ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch {
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkWebService(url: string): Promise<TSiteHealthService> {
  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    return {
      state: response.ok ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
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
  const [kong, prices, portfolio, transactions, cms, tokenAssets, chains] = await Promise.all([
    checkKong(),
    checkPrices(),
    checkPortfolio(),
    checkTransactions(),
    checkWebService(CMS_URL),
    checkWebService(TOKEN_ASSETS_URL),
    Promise.all(canonicalChains.map(checkRpc))
  ])
  const operational = chains.filter((chain) => chain.state === 'operational').length
  const checkedAt = new Date().toISOString()

  return {
    checkedAt,
    generatedAt: new Date().toISOString(),
    builtAt: normalizeTimestamp(process.env.NEXT_PUBLIC_SITE_UPDATED_AT),
    services: {
      kong,
      prices,
      portfolio,
      transactions,
      cms,
      tokenAssets,
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
const getDataCachedSiteHealth = unstable_cache(checkSiteHealth.bind(null), ['yearn-site-health-v3'], {
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
