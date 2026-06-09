import type { VercelRequest, VercelResponse } from '@vercel/node'
import { invalidateVaults, type VaultIdentifier } from '../lib/holdings/services/cache'
import { isHoldingsStorageEnabled } from '../lib/holdings/storage/redis'

const ADMIN_ALLOWED_ORIGIN_DEFAULTS = ['http://localhost:3000', 'http://127.0.0.1:3000']
const ADMIN_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret'
}

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

function readCsvValues(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  )
}

function getAdminAllowedOrigins(): Set<string> {
  return new Set([...ADMIN_ALLOWED_ORIGIN_DEFAULTS, ...readCsvValues(process.env.ADMIN_ALLOWED_ORIGINS)])
}

function getRequestOrigin(req: VercelRequest): string | null {
  const origin = req.headers.origin
  if (Array.isArray(origin)) {
    return origin[0] ?? null
  }
  return origin ?? null
}

function applyAdminCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = getRequestOrigin(req)
  if (origin && !getAdminAllowedOrigins().has(origin)) {
    return false
  }

  for (const [key, value] of Object.entries(ADMIN_CORS_HEADERS)) {
    res.setHeader(key, value)
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyAdminCorsHeaders(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

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

  // Check Redis storage is enabled
  if (!isHoldingsStorageEnabled()) {
    return res.status(503).json({ error: 'Caching not enabled (Redis storage not configured)' })
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
