import { isUnauthenticatedLocalDevelopmentRequest } from '@/server/holdings/ledger/access'
import { ADMIN_POST_CORS_HEADERS, json, noContent, readJsonBody } from '@/server/http'
import { ensureHoldingsStorageInitialized, isHoldingsStorageEnabled } from '@/server/lib/holdings'
import { invalidateVaults, type VaultIdentifier } from '@/server/lib/holdings/services/cache'
import { appendWalletLedgerInvalidation } from '@/server/lib/holdings/services/ledger/walletInvalidation'
import { getHoldingsLedgerRedisClient } from '@/server/lib/holdings/storage/ledgerRedis'
import { getHoldingsRedisClient } from '@/server/lib/holdings/storage/redis'

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

interface InvalidateRequestBody {
  vaults: Array<{ address: string; chainId: number; fromBlock?: number }>
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
    if (typeof v.chainId !== 'number' || !Number.isSafeInteger(v.chainId) || v.chainId <= 0) return false
    if (
      v.fromBlock !== undefined &&
      (typeof v.fromBlock !== 'number' || !Number.isSafeInteger(v.fromBlock) || v.fromBlock < 0)
    ) {
      return false
    }
  }

  return true
}

export function OPTIONS(): Response {
  return noContent(ADMIN_POST_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  if (!isUnauthenticatedLocalDevelopmentRequest(request)) {
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      return json({ error: 'Admin endpoint not configured' }, { status: 503, headers: ADMIN_POST_CORS_HEADERS })
    }
    if (request.headers.get('x-admin-secret') !== adminSecret) {
      return json({ error: 'Unauthorized' }, { status: 401, headers: ADMIN_POST_CORS_HEADERS })
    }
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

    const requestedVaults = Array.from(
      body.vaults
        .reduce((byIdentity, vault) => {
          const address = vault.address.toLowerCase()
          const identity = `${vault.chainId}:${address}`
          const fromBlock = vault.fromBlock ?? 0
          const existing = byIdentity.get(identity)
          byIdentity.set(identity, {
            address,
            chainId: vault.chainId,
            fromBlock: Math.min(existing?.fromBlock ?? fromBlock, fromBlock)
          })
          return byIdentity
        }, new Map<string, { address: string; chainId: number; fromBlock: number }>())
        .values()
    )
    const vaults: VaultIdentifier[] = requestedVaults.map(({ address, chainId }) => ({ address, chainId }))

    const invalidatedCount = await invalidateVaults(vaults)
    if (invalidatedCount !== vaults.length) {
      throw new Error('Legacy holdings vault invalidation did not complete')
    }
    const redis = getHoldingsLedgerRedisClient() ?? getHoldingsRedisClient()
    if (!redis) {
      throw new Error('Holdings Redis client unavailable after initialization')
    }
    const ledgerInvalidationSequence = await appendWalletLedgerInvalidation({
      redis,
      vaults: requestedVaults
    })
    const timestamp = new Date().toISOString()

    return json(
      {
        success: true,
        invalidated: invalidatedCount,
        ledgerInvalidationSequence,
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
