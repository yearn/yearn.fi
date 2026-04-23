import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supportsArchiveAllocationHistory } from '../../src/components/shared/constants/archiveAllocationHistory'
import { OPTIMIZATION_GET_CORS_HEADERS, setCorsHeaders } from './_lib/cors'
import { readLocalSankeyMockupPanels } from './_lib/localSankeyMockup'

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, OPTIMIZATION_GET_CORS_HEADERS)

  if (req.method === 'OPTIONS') {
    return res.status(204).send(null)
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const vault = req.query.vault as string | undefined
  const rawChainId = req.query.chainId as string | undefined
  const chainId = rawChainId ? Number(rawChainId) : NaN

  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
  if (!supportsArchiveAllocationHistory(chainId, vault)) {
    return res.status(404).json([])
  }

  try {
    const panels = await readLocalSankeyMockupPanels({
      vaultAddress: vault as `0x${string}`
    })

    if (!panels) {
      return res.status(404).json([])
    }

    return res.status(200).setHeader('Cache-Control', CACHE_CONTROL).json(panels)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(503).json({ error: message })
  }
}
