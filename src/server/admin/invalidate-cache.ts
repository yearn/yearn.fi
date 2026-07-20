import { ADMIN_POST_CORS_HEADERS, json, noContent, readJsonBody } from '../http'
import { ensureHoldingsStorageInitialized, isHoldingsStorageEnabled } from '../lib/holdings'
import { invalidateVaults, type VaultIdentifier } from '../lib/holdings/services/cache'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

interface InvalidateRequestBody {
  vaults: Array<{ address: string; chainId: number }>
}

function validateBody(body: unknown): body is InvalidateRequestBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.vaults)) return false
  if (b.vaults.length === 0) return false

  for (const vault of b.vaults) {
    if (!vault || typeof vault !== 'object') return false
    const v = vault as Record<string, unknown>
    if (typeof v.address !== 'string' || !isValidAddress(v.address)) return false
    if (typeof v.chainId !== 'number' || !Number.isInteger(v.chainId)) return false
  }

  return true
}

export function OPTIONS(): Response {
  return noContent(ADMIN_POST_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  // Check admin secret
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return json({ error: 'Admin endpoint not configured' }, { status: 503, headers: ADMIN_POST_CORS_HEADERS })
  }

  const providedSecret = request.headers.get('x-admin-secret')
  if (providedSecret !== adminSecret) {
    return json({ error: 'Unauthorized' }, { status: 401, headers: ADMIN_POST_CORS_HEADERS })
  }

  // Check Redis storage is enabled
  if (!isHoldingsStorageEnabled()) {
    return json(
      { error: 'Caching not enabled (UPSTASH_REDIS_REST_URL_PORTFOLIO/TOKEN_PORTFOLIO not configured)' },
      { status: 503, headers: ADMIN_POST_CORS_HEADERS }
    )
  }

  // Validate request body
  const body = await readJsonBody<unknown>(request)
  if (!validateBody(body)) {
    return json(
      {
        error: 'Invalid request body',
        expected: {
          vaults: [{ address: '0x...', chainId: 1 }]
        }
      },
      { status: 400, headers: ADMIN_POST_CORS_HEADERS }
    )
  }

  try {
    await ensureHoldingsStorageInitialized()
    if (!isHoldingsStorageEnabled()) {
      return json(
        { error: 'Caching not enabled (UPSTASH_REDIS_REST_URL_PORTFOLIO/TOKEN_PORTFOLIO not configured)' },
        { status: 503, headers: ADMIN_POST_CORS_HEADERS }
      )
    }

    const vaults: VaultIdentifier[] = body.vaults.map((v) => ({
      address: v.address,
      chainId: v.chainId
    }))

    const invalidatedCount = await invalidateVaults(vaults)
    const timestamp = new Date().toISOString()

    return json(
      {
        success: true,
        invalidated: invalidatedCount,
        vaults: vaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`),
        timestamp
      },
      { headers: ADMIN_POST_CORS_HEADERS }
    )
  } catch (error) {
    console.error('[Admin] Invalidate cache error:', error)
    return json({ error: 'Failed to invalidate cache' }, { status: 500, headers: ADMIN_POST_CORS_HEADERS })
  }
}

export default POST
