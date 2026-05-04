import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildVaultMarkdown, KONG_REST_BASE } from '../lib/aio'
import type { TVaultSnapshot } from '../lib/aio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { chainId, address } = req.query

  if (!chainId || !address || typeof chainId !== 'string' || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chainId or address' })
  }
  if (!/^\d+$/.test(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' })
  }

  const chainIdNum = Number(chainId)

  try {
    const response = await fetch(`${KONG_REST_BASE}/snapshot/${chainId}/${address}`, {
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        error: response.status === 404 ? 'Vault not found' : 'Failed to fetch vault data from upstream'
      })
    }

    const snapshot = (await response.json()) as TVaultSnapshot

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).send(buildVaultMarkdown(snapshot, chainIdNum, address))
  } catch (error) {
    console.error('Error generating vault markdown:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
