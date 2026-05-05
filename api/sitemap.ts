import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { TVaultListEntry } from './lib/aio'
import { buildSitemap, KONG_VAULT_LIST_URL } from './lib/aio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      headers: { Accept: 'application/json' }
    })
    const vaults: TVaultListEntry[] = response.ok ? ((await response.json()) as TVaultListEntry[]) : []

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).send(buildSitemap(vaults))
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return res
      .status(500)
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      )
  }
}
