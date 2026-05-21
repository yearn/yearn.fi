import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OPTIMIZATION_POST_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import { fetchVaultOnChainState, getRpcConfig, MAX_VAULT_STATE_STRATEGIES } from './_lib/rpc'

const CACHE_CONTROL = 'private, no-store'
const VAULT_STATE_ERROR_MESSAGE = 'Unable to load vault state'
const MAX_VAULT_STATE_BODY_BYTES = 10 * 1024
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_POST_CORS_HEADERS)

  if (req.method === 'OPTIONS') {
    return res.status(204).send(null)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_VAULT_STATE_BODY_BYTES) {
    return res.status(400).json({ error: 'Request body too large' })
  }

  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null

  if (!vault || !ADDRESS_PATTERN.test(vault)) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }
  if (chainId === null || !Number.isFinite(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
  if (!getRpcConfig(chainId)) {
    return res.status(400).json({ error: 'Unsupported chainId' })
  }
  if (!Array.isArray(payload.strategies)) {
    return res.status(400).json({ error: 'No strategy addresses provided' })
  }
  if (payload.strategies.length > MAX_VAULT_STATE_STRATEGIES) {
    return res.status(400).json({ error: `Too many strategy addresses: maximum ${MAX_VAULT_STATE_STRATEGIES}` })
  }
  if (
    !payload.strategies.every(
      (strategy): strategy is string => typeof strategy === 'string' && ADDRESS_PATTERN.test(strategy)
    )
  ) {
    return res.status(400).json({ error: 'Invalid strategy address' })
  }
  const strategies = payload.strategies
  if (strategies.length === 0) {
    return res.status(400).json({ error: 'No strategy addresses provided' })
  }

  try {
    const state = await fetchVaultOnChainState(chainId, vault, strategies)

    const strategyDebts: Record<string, string> = {}
    for (const [addr, debt] of state.strategyDebts) {
      strategyDebts[addr] = debt.toString()
    }

    return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json({
      totalAssets: state.totalAssets.toString(),
      strategyDebts,
      unallocatedBps: state.unallocatedBps
    })
  } catch (error) {
    console.error(VAULT_STATE_ERROR_MESSAGE, error)
    return res.status(503).json({ error: VAULT_STATE_ERROR_MESSAGE })
  }
}
