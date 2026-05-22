import { json, noContent, POST_CORS_HEADERS, readJsonBody } from '../http'
import { fetchVaultOnChainState } from './_lib/rpc'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

export function OPTIONS(): Response {
  return noContent(POST_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  const payload = await readJsonBody<Record<string, unknown>>(request)
  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null
  const strategies = Array.isArray(payload.strategies)
    ? payload.strategies.filter((s: unknown): s is string => typeof s === 'string')
    : []

  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    return json({ error: 'Invalid vault address' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (chainId === null || !Number.isFinite(chainId)) {
    return json({ error: 'Invalid chainId' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (strategies.length === 0) {
    return json({ error: 'No strategy addresses provided' }, { status: 400, headers: POST_CORS_HEADERS })
  }

  try {
    const state = await fetchVaultOnChainState(chainId, vault, strategies)

    const strategyDebts = Object.fromEntries(
      Array.from(state.strategyDebts, ([address, debt]) => [address, debt.toString()])
    )

    return json(
      {
        totalAssets: state.totalAssets.toString(),
        strategyDebts,
        unallocatedBps: state.unallocatedBps
      },
      { headers: { ...POST_CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message }, { status: 503, headers: POST_CORS_HEADERS })
  }
}

export default POST
