import { GET_CORS_HEADERS, json, noContent, queryValue, WALLET_SCOPED_CACHE_CONTROL } from '../http'
import type { HoldingsActivityTypeFilter, VaultVersion } from '../lib/holdings'
import { ensureHoldingsStorageInitialized } from '../lib/holdings'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseVersion(value: string | string[] | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

function parseLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
    return 10
  }

  return Math.min(Math.max(parsedValue, 1), 50)
}

function parseOffset(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
    return 0
  }

  return Math.max(parsedValue, 0)
}

function parseType(value: string | string[] | undefined): HoldingsActivityTypeFilter {
  const rawValue = Array.isArray(value) ? value[0] : value

  return rawValue === 'deposit' ||
    rawValue === 'withdraw' ||
    rawValue === 'stake' ||
    rawValue === 'unstake' ||
    rawValue === 'transfer' ||
    rawValue === 'swap'
    ? rawValue
    : 'all'
}

function parseChainId(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsedValue = Number(rawValue)

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function parseTimestamp(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue) {
    return null
  }

  const parsedValue = Number(rawValue)

  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings activity storage initialization error:', error)
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
  const limitParam = queryValue(request, 'limit')
  const offsetParam = queryValue(request, 'offset')
  const typeParam = queryValue(request, 'type')
  const chainIdParam = queryValue(request, 'chainId')
  const startTimestampParam = queryValue(request, 'startTimestamp')
  const endTimestampParam = queryValue(request, 'endTimestamp')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  try {
    const { getHoldingsActivity } = await import('../lib/holdings')
    const activity = await getHoldingsActivity(
      address,
      parseVersion(versionParam),
      parseLimit(limitParam),
      parseOffset(offsetParam),
      {
        type: parseType(typeParam),
        chainId: parseChainId(chainIdParam),
        startTimestamp: parseTimestamp(startTimestampParam),
        endTimestamp: parseTimestamp(endTimestampParam)
      }
    )

    return json(activity, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Holdings activity error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return json(
        {
          error: 'Failed to fetch holdings activity',
          message,
          stack
        },
        { status: 502, headers: GET_CORS_HEADERS }
      )
    }

    return json({ error: 'Failed to fetch holdings activity' }, { status: 502, headers: GET_CORS_HEADERS })
  }
}

export default GET
