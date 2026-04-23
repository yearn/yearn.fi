import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureSchemaInitialized, isDatabaseEnabled } from '../lib/holdings/db/connection'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check admin secret
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return res.status(503).json({ error: 'Admin endpoint not configured' })
  }

  const providedSecret = req.headers['x-admin-secret']
  if (providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Check database is enabled
  if (!isDatabaseEnabled()) {
    return res.status(503).json({ error: 'Caching not enabled (DATABASE_URL not configured)' })
  }

  // Validate request body
  const body = req.body
  if (!validateBody(body)) {
    return res.status(400).json({
      error: 'Invalid request body',
      expected: {
        vaults: [{ address: '0x...', chainId: 1 }]
      }
    })
  }

  try {
    await ensureSchemaInitialized()

    const vaults: VaultIdentifier[] = body.vaults.map((v) => ({
      address: v.address,
      chainId: v.chainId
    }))

    const invalidatedCount = await invalidateVaults(vaults)
    const timestamp = new Date().toISOString()

    return res.status(200).json({
      success: true,
      invalidated: invalidatedCount,
      vaults: vaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`),
      timestamp
    })
  } catch (error) {
    console.error('[Admin] Invalidate cache error:', error)
    return res.status(500).json({ error: 'Failed to invalidate cache' })
  }
}
