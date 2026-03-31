import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit } from '../../lib/holdings'

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function getClientIdentifier(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
  }

  const ua = req.headers['user-agent'] || ''
  const lang = req.headers['accept-language'] || ''
  const encoding = req.headers['accept-encoding'] || ''
  return `fp-${simpleHash(ua + lang + encoding)}`
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseUnknownTransferInPnlMode(value: unknown): 'strict' | 'zero_basis' | 'windfall' {
  return value === 'strict' || value === 'zero_basis' || value === 'windfall' ? value : 'windfall'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = getClientIdentifier(req)
  const rateCheck = await checkRateLimit(clientId)
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfter))
    return res.status(429).json({ error: 'Too many requests', retryAfter: rateCheck.retryAfter })
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return res.status(503).json({
      error: 'Holdings PnL drilldown API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const { address, vault, version, unknownMode } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  if (vault !== undefined && (typeof vault !== 'string' || !isValidAddress(vault))) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }

  try {
    const { getHoldingsPnLDrilldown } = await import('../../lib/holdings')
    const pnl = await getHoldingsPnLDrilldown(
      address,
      version === 'v2' || version === 'v3' ? version : 'all',
      parseUnknownTransferInPnlMode(Array.isArray(unknownMode) ? unknownMode[0] : unknownMode),
      'seq',
      'paged',
      vault
    )

    if (pnl.summary.totalVaults === 0) {
      return res.status(404).json({
        error: vault ? 'No matching holdings found for address and vault' : 'No holdings found for address'
      })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(pnl)
  } catch (error) {
    console.error('Holdings PnL drilldown error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return res.status(502).json({
        error: 'Failed to fetch holdings PnL drilldown',
        message,
        stack
      })
    }

    return res.status(502).json({ error: 'Failed to fetch holdings PnL drilldown' })
  }
}
