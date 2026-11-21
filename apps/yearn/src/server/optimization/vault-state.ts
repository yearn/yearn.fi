import { json, noContent, POST_CORS_HEADERS } from '../http'
import { readOptimizations } from './_lib/redis'
import { fetchVaultOnChainState } from './_lib/rpc'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const MAX_STRATEGIES = 50
const MAX_BODY_BYTES = 10 * 1024
const RESPONSE_HEADERS = { ...POST_CORS_HEADERS, 'Cache-Control': 'no-store' }

export function OPTIONS(): Response {
  return noContent(POST_CORS_HEADERS)
}

async function readBodyText(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[] = [],
  size = 0
): Promise<string | null> {
  const { done, value } = await reader.read()
  if (done) {
    return Buffer.concat(chunks).toString('utf8')
  }
  if (size + value.byteLength > MAX_BODY_BYTES) {
    await reader.cancel()
    return null
  }
  return readBodyText(reader, [...chunks, value], size + value.byteLength)
}

function parseVaultStatePayload(text: string): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(text)

    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  } catch (_error) {
    return {}
  }
}

export async function POST(request: Request): Promise<Response> {
  const text = request.body ? await readBodyText(request.body.getReader()).catch(() => undefined) : ''
  if (text === undefined) {
    return json({ error: 'Failed to read request body' }, { status: 400, headers: POST_CORS_HEADERS })
  }
  if (text === null) {
    return json({ error: 'Request body too large' }, { status: 413, headers: POST_CORS_HEADERS })
  }

  const payload = parseVaultStatePayload(text)
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
        optimization.vault.toLowerCase() === vault.toLowerCase() && optimization.source.chainId === chainId
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
    console.error('Error reading vault state:', error)
    return json({ error: 'Vault state unavailable' }, { status: 503, headers: POST_CORS_HEADERS })
  }
}

export default POST
