import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { TVaultListEntry } from '../lib/aio'
import { buildVaultsMarkdown, KONG_REST_BASE } from '../lib/aio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { chainId: chainIdParam } = req.query
  const chainId =
    chainIdParam && typeof chainIdParam === 'string' && /^\d+$/.test(chainIdParam) ? Number(chainIdParam) : undefined

  try {
    const response = await fetch(`${KONG_REST_BASE}/list/vaults`, {
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch vault list from upstream' })
    }

    const vaults = (await response.json()) as TVaultListEntry[]

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).send(buildVaultsMarkdown(vaults, chainId))
  } catch (error) {
    console.error('Error generating vaults markdown:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
