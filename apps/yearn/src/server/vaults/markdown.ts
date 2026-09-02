import { kongVaultListSchema } from '@/components/shared/utils/schemas/kongVaultListSchema'

import { GET_CORS_HEADERS, json, noContent, queryValue } from '../http'
import { buildVaultsMarkdown, KONG_VAULT_LIST_URL, resolveSourceUpdatedAt } from '../lib/aio'

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

function resolveChainId(request: Request): { chainId?: number; isValid: boolean } {
  const chainIdParam = queryValue(request, 'chainId')
  if (chainIdParam === undefined) {
    return { isValid: true }
  }
  if (typeof chainIdParam !== 'string' || !/^\d+$/.test(chainIdParam)) {
    return { isValid: false }
  }

  const chainId = Number(chainIdParam)
  return Number.isSafeInteger(chainId) && chainId > 0 ? { chainId, isValid: true } : { isValid: false }
}

function getSourceUpdatedAt(payload: unknown, lastModifiedHeader: string | null): string | undefined {
  const entryTimestamps = Array.isArray(payload)
    ? payload.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return []
        }
        const record = entry as Record<string, unknown>
        return [record.updatedAt, record.lastModified]
      })
    : []
  return resolveSourceUpdatedAt(lastModifiedHeader, ...entryTimestamps)
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

async function handleVaultsMarkdown(request: Request, includeBody: boolean): Promise<Response> {
  const { chainId, isValid } = resolveChainId(request)
  if (!isValid) {
    return json({ error: 'Invalid chainId' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(MARKDOWN_UPSTREAM_TIMEOUT_MS)
    })

    if (!response.ok) {
      return json({ error: 'Failed to fetch vault list from upstream' }, { status: 502, headers: GET_CORS_HEADERS })
    }

    const payload: unknown = await response.json()
    const parsed = kongVaultListSchema.safeParse(payload)
    if (!parsed.success) {
      return json({ error: 'Invalid vault list from upstream' }, { status: 502, headers: GET_CORS_HEADERS })
    }

    const sourceUpdatedAt = getSourceUpdatedAt(payload, response.headers.get('Last-Modified'))
    return markdownResponse(includeBody ? buildVaultsMarkdown(parsed.data, chainId, { sourceUpdatedAt }) : null)
  } catch (error) {
    console.error('Error generating vaults markdown:', error)
    return json(
      { error: isTimeoutError(error) ? 'Upstream request timed out' : 'Failed to fetch vault list from upstream' },
      { status: isTimeoutError(error) ? 504 : 502, headers: GET_CORS_HEADERS }
    )
  }
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  return handleVaultsMarkdown(request, true)
}

export async function HEAD(request: Request): Promise<Response> {
  return handleVaultsMarkdown(request, false)
}

export default GET
