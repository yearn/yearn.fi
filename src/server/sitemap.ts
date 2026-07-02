import { GET_CORS_HEADERS, noContent } from './http'
import type { TVaultListEntry } from './lib/aio'
import { buildSitemap, KONG_VAULT_LIST_URL } from './lib/aio'

const SITEMAP_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=3600'
const SITEMAP_HEADERS = {
  ...GET_CORS_HEADERS,
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': SITEMAP_CACHE_CONTROL
} as const
const EMPTY_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

function sitemapResponse(xml: string | null, status = 200): Response {
  return new Response(xml, {
    status,
    headers: SITEMAP_HEADERS
  })
}

async function handleSitemap(includeBody: boolean): Promise<Response> {
  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      headers: { Accept: 'application/json' }
    })
    const vaults: TVaultListEntry[] = response.ok ? ((await response.json()) as TVaultListEntry[]) : []

    return sitemapResponse(includeBody ? buildSitemap(vaults) : null)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return sitemapResponse(includeBody ? EMPTY_SITEMAP : null, 500)
  }
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(): Promise<Response> {
  return handleSitemap(true)
}

export async function HEAD(): Promise<Response> {
  return handleSitemap(false)
}

export default GET
