import { canonicalChains } from '@/config/chainDefinitions'
import { GET_CORS_HEADERS, json, noContent } from '@/server/http'
import { KONG_VAULT_LIST_URL } from '@/server/lib/aio'
import { getVercelCdnCacheHeaders } from '@/server/lib/cacheHeaders'
import type { TSiteHealth, TSiteHealthChain, TSiteHealthState } from '@/types/siteStatus'

const HEALTH_CHECK_TIMEOUT_MS = 4_000
const STATUS_CACHE_HEADERS = {
  ...GET_CORS_HEADERS,
  ...getVercelCdnCacheHeaders('public, s-maxage=30, stale-while-revalidate=30')
} as const

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

export async function GET(): Promise<Response> {
  const [kong, chains] = await Promise.all([checkKong(), Promise.all(canonicalChains.map(checkRpc))])
  const operational = chains.filter((chain) => chain.state === 'operational').length

  return json(
    {
      checkedAt: new Date().toISOString(),
      services: {
        kong,
        rpc: {
          state: getRpcState(operational, chains.length),
          operational,
          total: chains.length,
          chains
        }
      }
    } satisfies TSiteHealth,
    { headers: STATUS_CACHE_HEADERS }
  )
}

export default GET
