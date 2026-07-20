import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import type { TVaultSnapshot } from '../lib/aio'
import { buildVaultMarkdown, KONG_REST_BASE } from '../lib/aio'

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
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      return json(
        { error: response.status === 404 ? 'Vault not found' : 'Failed to fetch vault data from upstream' },
        { status: response.status === 404 ? 404 : 502, headers: GET_CORS_HEADERS }
      )
    }

    const snapshot = (await response.json()) as TVaultSnapshot
    const markdown = buildVaultMarkdown(snapshot, Number(chainId), address)
    return markdownResponse(includeBody ? markdown : null)
  } catch (error) {
    console.error('Error generating vault markdown:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
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
