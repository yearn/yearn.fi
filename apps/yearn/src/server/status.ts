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

type TProbeDiagnostics = {
  httpStatus?: number
  errorName?: string
  errorCode?: string
  causeCode?: string
  reason?: 'missing_configuration'
}

type THealthDiagnostics = Record<string, TProbeDiagnostics>

const siteHealthCache: TSiteHealthCache = {}

function getErrorCode(error: unknown): string | undefined {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : undefined
}

function getErrorDiagnostics(error: unknown): TProbeDiagnostics {
  // Fetch errors can contain credential-bearing URLs in their messages and stacks.
  const errorName = error instanceof Error ? error.name : ''
  return {
    errorName: ['Error', 'TypeError', 'SyntaxError', 'AbortError', 'TimeoutError'].includes(errorName)
      ? errorName
      : 'UnknownError',
    errorCode: getErrorCode(error),
    causeCode: getErrorCode(error instanceof Error ? error.cause : undefined)
  }
}

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

async function checkKong(diagnostics: THealthDiagnostics): Promise<TSiteHealth['services']['kong']> {
  const startedAt = performance.now()
  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      method: 'HEAD',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    diagnostics.kong = { httpStatus: response.status }
    return {
      state: response.ok ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt),
      cacheRefreshedAt: normalizeTimestamp(response.headers.get('x-last-refresh'))
    }
  } catch (error) {
    diagnostics.kong = { ...diagnostics.kong, ...getErrorDiagnostics(error) }
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkPrices(diagnostics: THealthDiagnostics): Promise<TSiteHealth['services']['prices']> {
  const startedAt = performance.now()
  const apiKey = holdingsConfig.yearnPricesApiKey
  if (!apiKey) {
    diagnostics.prices = { reason: 'missing_configuration' }
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
    diagnostics.prices = { httpStatus: response.status }
    const payload = (await response.json()) as { coins?: Record<string, { prices?: Array<{ price?: number }> }> }
    const hasPrice = payload.coins?.[PRICE_COIN]?.prices?.some(
      ({ price }) => Number.isFinite(price) && Number(price) > 0
    )

    return {
      state: response.ok && hasPrice ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    diagnostics.prices = { ...diagnostics.prices, ...getErrorDiagnostics(error) }
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkPortfolio(diagnostics: THealthDiagnostics): Promise<TSiteHealth['services']['portfolio']> {
  const startedAt = performance.now()
  const url = process.env.ENVIO_GRAPHQL_URL?.trim()
  if (!url) {
    diagnostics.portfolio = { reason: 'missing_configuration' }
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
    diagnostics.portfolio = { httpStatus: response.status }
    const payload = (await response.json()) as { data?: { Deposit?: unknown[] }; errors?: unknown[] }

    return {
      state: response.ok && Array.isArray(payload.data?.Deposit) && !payload.errors ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    diagnostics.portfolio = { ...diagnostics.portfolio, ...getErrorDiagnostics(error) }
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkTransactions(diagnostics: THealthDiagnostics): Promise<TSiteHealth['services']['transactions']> {
  const startedAt = performance.now()
  const apiKey = process.env.ENSO_API_KEY?.trim()
  if (!apiKey) {
    diagnostics.transactions = { reason: 'missing_configuration' }
    return { state: 'unavailable', latencyMs: 0 }
  }

  try {
    const response = await fetch(ENSO_NETWORKS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    diagnostics.transactions = { httpStatus: response.status }
    const payload = (await response.json()) as unknown

    return {
      state: response.ok && Array.isArray(payload) && payload.length > 0 ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    diagnostics.transactions = { ...diagnostics.transactions, ...getErrorDiagnostics(error) }
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkWebService(
  service: 'cms' | 'tokenAssets',
  url: string,
  diagnostics: THealthDiagnostics
): Promise<TSiteHealthService> {
  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      cache: 'no-store'
    })
    diagnostics[service] = { httpStatus: response.status }
    return {
      state: response.ok ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    diagnostics[service] = { ...diagnostics[service], ...getErrorDiagnostics(error) }
    return { state: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function checkRpc(
  chain: (typeof canonicalChains)[number],
  diagnostics: THealthDiagnostics
): Promise<TSiteHealthChain> {
  const startedAt = performance.now()
  const service = `rpc:${chain.id}`
  const rpcUrl = getRpcUrl(chain)
  if (!rpcUrl) {
    diagnostics[service] = { reason: 'missing_configuration' }
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
    diagnostics[service] = { httpStatus: response.status }
    const payload = (await response.json()) as { result?: string }
    const expectedChainId = `0x${chain.id.toString(16)}`
    return {
      chainId: chain.id,
      name: chain.name,
      state: response.ok && payload.result?.toLowerCase() === expectedChainId ? 'operational' : 'unavailable',
      latencyMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    diagnostics[service] = { ...diagnostics[service], ...getErrorDiagnostics(error) }
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
  const startedAt = new Date().toISOString()
  const startedAtMs = performance.now()
  const diagnostics: THealthDiagnostics = {}
  const [kong, prices, portfolio, transactions, cms, tokenAssets, chains] = await Promise.all([
    checkKong(diagnostics),
    checkPrices(diagnostics),
    checkPortfolio(diagnostics),
    checkTransactions(diagnostics),
    checkWebService('cms', CMS_URL, diagnostics),
    checkWebService('tokenAssets', TOKEN_ASSETS_URL, diagnostics),
    Promise.all(canonicalChains.map((chain) => checkRpc(chain, diagnostics)))
  ])
  const operational = chains.filter((chain) => chain.state === 'operational').length
  const checkedAt = new Date().toISOString()
  const failedChecks = [
    ...Object.entries({ kong, prices, portfolio, transactions, cms, tokenAssets }).map(([service, result]) => ({
      service,
      ...result
    })),
    ...chains.map((chain) => ({ service: `rpc:${chain.chainId}`, ...chain }))
  ]
    .filter(({ state }) => state === 'unavailable')
    .map(({ service, latencyMs }) => {
      const detail = diagnostics[service]
      const reason =
        detail?.reason ??
        (detail?.httpStatus !== undefined && (detail.httpStatus < 200 || detail.httpStatus >= 300)
          ? 'http_error'
          : detail?.errorName === 'TimeoutError'
            ? 'timeout'
            : detail?.errorName
              ? 'exception'
              : 'invalid_response')
      return { service, latencyMs, ...detail, reason }
    })
  if (failedChecks.length > 0) {
    console.warn(
      '[SiteHealth]',
      JSON.stringify({
        event: 'site_health_check_failed',
        startedAt,
        checkedAt,
        elapsedMs: Math.round(performance.now() - startedAtMs),
        timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
        region: process.env.VERCEL_REGION ?? 'local',
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
        failedChecks
      })
    )
  }

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
const getDataCachedSiteHealth = unstable_cache(checkSiteHealth.bind(null), ['yearn-site-health-v4'], {
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
