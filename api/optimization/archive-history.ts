import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supportsArchiveAllocationHistory } from '../../src/components/shared/constants/archiveAllocationHistory'
import { fetchArchiveAllocationHistory } from './_lib/archiveHistory'
import { OPTIMIZATION_GET_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import { readLocalArchiveAllocationHistoryArtifact } from './_lib/localArchiveHistory'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

function parseStrategies(queryValue: string | string[] | undefined): `0x${string}`[] {
  const serialized = Array.isArray(queryValue) ? queryValue.join(',') : (queryValue ?? '')
  return serialized
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(value))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_GET_CORS_HEADERS)

  if (req.method === 'OPTIONS') {
    return res.status(204).send(null)
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const vault = req.query.vault as string | undefined
  const fromTimestamp = req.query.fromTimestamp as string | undefined
  const rawChainId = req.query.chainId as string | undefined
  const chainId = rawChainId ? Number(rawChainId) : NaN
  const strategies = parseStrategies(req.query.strategies)

  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
  if (!fromTimestamp) {
    return res.status(400).json({ error: 'fromTimestamp parameter required' })
  }
  if (strategies.length === 0) {
    return res.status(400).json({ error: 'No strategy addresses provided' })
  }
  if (!supportsArchiveAllocationHistory(chainId, vault)) {
    return res.status(404).json([])
  }

  try {
    const localArtifact = await readLocalArchiveAllocationHistoryArtifact({
      chainId,
      vaultAddress: vault as `0x${string}`
    })

    if (localArtifact) {
      return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(localArtifact.records)
    }

    const history = await fetchArchiveAllocationHistory({
      chainId,
      vaultAddress: vault as `0x${string}`,
      strategyAddresses: strategies,
      fromTimestampUtc: fromTimestamp
    })

    return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(history)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(503).json({ error: message })
  }
}
