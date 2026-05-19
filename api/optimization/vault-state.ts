import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OPTIMIZATION_POST_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import { fetchVaultOnChainState } from './_lib/rpc'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_POST_CORS_HEADERS)

  if (req.method === 'OPTIONS') {
    return res.status(204).send(null)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null
  const strategies = Array.isArray(payload.strategies)
    ? payload.strategies.filter((s: unknown): s is string => typeof s === 'string')
    : []

  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }
  if (chainId === null || !Number.isFinite(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
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
    const message = error instanceof Error ? error.message : String(error)
    return res.status(503).json({ error: message })
  }
}
