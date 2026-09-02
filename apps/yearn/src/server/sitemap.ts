import { kongVaultListSchema } from '@/components/shared/utils/schemas/kongVaultListSchema'

import { GET_CORS_HEADERS, noContent } from './http'
import type { TVaultListEntry } from './lib/aio'
import { buildSitemap, KONG_VAULT_LIST_URL } from './lib/aio'

const SITEMAP_UPSTREAM_TIMEOUT_MS = 7_000
const SITEMAP_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=3600'
const SITEMAP_HEADERS = {
  ...GET_CORS_HEADERS,
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': SITEMAP_CACHE_CONTROL
} as const
const SITEMAP_FAILURE_HEADERS = {
  ...GET_CORS_HEADERS,
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'no-store'
} as const

type TUpstreamTimestamp = string | number | null | undefined

function upstreamTimestamp(value: unknown): TUpstreamTimestamp {
  return typeof value === 'string' || typeof value === 'number' || value === null ? value : undefined
}

function parseVaultList(payload: unknown): TVaultListEntry[] | null {
  const result = kongVaultListSchema.safeParse(payload)
  if (!result.success || result.data.length === 0 || !Array.isArray(payload)) {
    return null
  }

  return result.data.map((vault, index) => {
    const rawVault = payload[index]
    const rawRecord = typeof rawVault === 'object' && rawVault !== null ? (rawVault as Record<string, unknown>) : {}
    return {
      ...vault,
      updatedAt: upstreamTimestamp(rawRecord.updatedAt),
      lastModified: upstreamTimestamp(rawRecord.lastModified)
    }
  })
}

function sitemapResponse(xml: string | null, status = 200): Response {
  return new Response(xml, {
    status,
    headers: status === 200 ? SITEMAP_HEADERS : SITEMAP_FAILURE_HEADERS
  })
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

async function handleSitemap(includeBody: boolean): Promise<Response> {
  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(SITEMAP_UPSTREAM_TIMEOUT_MS)
    })
    if (!response.ok) {
      console.error(`Error generating sitemap: Kong returned HTTP ${response.status}`)
      return sitemapResponse(null, 502)
    }

    const vaults = parseVaultList(await response.json())
    if (!vaults) {
      console.error('Error generating sitemap: Kong returned an invalid or empty vault list')
      return sitemapResponse(null, 502)
    }

    return sitemapResponse(includeBody ? buildSitemap(vaults) : null)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return sitemapResponse(null, isTimeoutError(error) ? 504 : 502)
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
