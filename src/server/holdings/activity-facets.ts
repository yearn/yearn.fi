import { GET_CORS_HEADERS, json, noContent, queryValue, WALLET_SCOPED_CACHE_CONTROL } from '../http'
import type { VaultVersion } from '../lib/holdings'
import { ensureHoldingsStorageInitialized } from '../lib/holdings'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseVersion(value: string | string[] | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings activity facets storage initialization error:', error)
    return json({ error: 'Failed to initialize holdings storage' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return json(
      {
        error: 'Holdings activity API not configured',
        details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
      },
      { status: 503, headers: GET_CORS_HEADERS }
    )
  }

  const address = queryValue(request, 'address')
  const versionParam = queryValue(request, 'version')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  try {
    const { getHoldingsActivityFacetResponse } = await import('../lib/holdings')
    const version = parseVersion(versionParam)
    const facetsResponse = await getHoldingsActivityFacetResponse(address, version)

    return json(facetsResponse, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Holdings activity facets error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return json(
        {
          error: 'Failed to fetch holdings activity facets',
          message,
          stack
        },
        { status: 502, headers: GET_CORS_HEADERS }
      )
    }

    return json({ error: 'Failed to fetch holdings activity facets' }, { status: 502, headers: GET_CORS_HEADERS })
  }
}

export default GET
