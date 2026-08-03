import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import type { TVaultListEntry } from '../lib/aio'
import { buildVaultsMarkdown, KONG_VAULT_LIST_URL } from '../lib/aio'

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

function resolveChainId(request: Request): number | undefined {
  const chainIdParam = queryString(request, 'chainId')
  return chainIdParam && /^\d+$/.test(chainIdParam) ? Number(chainIdParam) : undefined
}

async function handleVaultsMarkdown(request: Request, includeBody: boolean): Promise<Response> {
  const chainId = resolveChainId(request)

  try {
    const response = await fetch(KONG_VAULT_LIST_URL, {
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      return json({ error: 'Failed to fetch vault list from upstream' }, { status: 502, headers: GET_CORS_HEADERS })
    }

    const vaults = (await response.json()) as TVaultListEntry[]
    return markdownResponse(includeBody ? buildVaultsMarkdown(vaults, chainId) : null)
  } catch (error) {
    console.error('Error generating vaults markdown:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
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
