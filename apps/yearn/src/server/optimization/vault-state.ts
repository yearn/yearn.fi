import { json, noContent, POST_CORS_HEADERS, readJsonBody } from '../http'
import { readOptimizations } from './_lib/redis'
import { fetchVaultOnChainState } from './_lib/rpc'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const MAX_STRATEGIES = 50
const RESPONSE_HEADERS = { ...POST_CORS_HEADERS, 'Cache-Control': 'no-store' }

export function OPTIONS(): Response {
  return noContent(POST_CORS_HEADERS)
}

async function readVaultStatePayload(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload = await readJsonBody<unknown>(request)

    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  } catch (_error) {
    return {}
  }
}

export async function POST(request: Request): Promise<Response> {
  const payload = await readVaultStatePayload(request)
  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null
  const strategies: unknown[] = Array.isArray(payload.strategies) ? payload.strategies : []

  if (!vault || !ADDRESS_PATTERN.test(vault)) {
    return json({ error: 'Invalid vault address' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (chainId === null || !Number.isFinite(chainId)) {
    return json({ error: 'Invalid chainId' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (strategies.length === 0) {
    return json({ error: 'No strategy addresses provided' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (strategies.length > MAX_STRATEGIES) {
    return json({ error: 'Too many strategy addresses' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (!strategies.every((s): s is string => typeof s === 'string' && ADDRESS_PATTERN.test(s))) {
    return json({ error: 'Invalid strategy address' }, { status: 400, headers: POST_CORS_HEADERS })
  }

  try {
    const isKnownVault = ((await readOptimizations()) ?? []).some(
      (optimization) =>
        optimization.vault.toLowerCase() === vault.toLowerCase() &&
        (optimization.source.chainId === null || optimization.source.chainId === chainId)
    )
    if (!isKnownVault) {
      return json(
        { error: `Vault not found in optimization payload: ${vault}` },
        { status: 404, headers: POST_CORS_HEADERS }
      )
    }

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
      { headers: RESPONSE_HEADERS }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message }, { status: 503, headers: POST_CORS_HEADERS })
  }
}

export default POST
