import { kongVaultSnapshotSchema } from '@/components/shared/utils/schemas/kongVaultSnapshotSchema'

import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import { buildVaultMarkdown, KONG_REST_BASE, resolveSourceUpdatedAt } from '../lib/aio'

const MARKDOWN_UPSTREAM_TIMEOUT_MS = 7_000
const MARKDOWN_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'
const MARKDOWN_HEADERS = {
  ...GET_CORS_HEADERS,
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': MARKDOWN_CACHE_CONTROL
} as const

function markdownResponse(markdown: string | null): Response {
  return new Response(markdown, {
    headers: MARKDOWN_HEADERS
  })
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getSourceUpdatedAt(payload: unknown, lastModifiedHeader: string | null): string | undefined {
  const snapshot = record(payload)
  const apy = record(snapshot.apy)
  const tvl = record(snapshot.tvl)
  return resolveSourceUpdatedAt(
    lastModifiedHeader,
    snapshot.updatedAt,
    snapshot.lastModified,
    snapshot.blockTime,
    apy.blockTime,
    tvl.blockTime
  )
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

async function handleVaultMarkdown(request: Request, includeBody: boolean): Promise<Response> {
  const chainId = queryString(request, 'chainId')
  const address = queryString(request, 'address')

  if (!chainId || !address) {
    return json({ error: 'Missing chainId or address' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!/^\d+$/.test(chainId)) {
    return json({ error: 'Invalid chainId' }, { status: 400, headers: GET_CORS_HEADERS })
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return json({ error: 'Invalid address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  try {
    const response = await fetch(`${KONG_REST_BASE}/snapshot/${chainId}/${address}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(MARKDOWN_UPSTREAM_TIMEOUT_MS)
    })

    if (!response.ok) {
      return json(
        { error: response.status === 404 ? 'Vault not found' : 'Failed to fetch vault data from upstream' },
        { status: response.status === 404 ? 404 : 502, headers: GET_CORS_HEADERS }
      )
    }

    const payload: unknown = await response.json()
    const parsed = kongVaultSnapshotSchema.safeParse(payload)
    if (!parsed.success) {
      return json({ error: 'Invalid vault data from upstream' }, { status: 502, headers: GET_CORS_HEADERS })
    }

    const sourceUpdatedAt = getSourceUpdatedAt(payload, response.headers.get('Last-Modified'))
    const cacheRefreshedAt = response.headers.get('x-last-refresh')
    const markdown = buildVaultMarkdown(parsed.data, Number(chainId), address, { sourceUpdatedAt, cacheRefreshedAt })
    return markdownResponse(includeBody ? markdown : null)
  } catch (error) {
    console.error('Error generating vault markdown:', error)
    return json(
      { error: isTimeoutError(error) ? 'Upstream request timed out' : 'Failed to fetch vault data from upstream' },
      { status: isTimeoutError(error) ? 504 : 502, headers: GET_CORS_HEADERS }
    )
  }
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  return handleVaultMarkdown(request, true)
}

export async function HEAD(request: Request): Promise<Response> {
  return handleVaultMarkdown(request, false)
}

export default GET
