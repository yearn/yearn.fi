import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { HoldingsEventFetchType, HoldingsEventPaginationMode } from '../lib/holdings'
import { checkRateLimit, ensureSchemaInitialized } from '../lib/holdings'

function simpleHash(str: string): string {
  const hash = Array.from(str).reduce((currentHash, char) => {
    const nextHash = (currentHash << 5) - currentHash + char.charCodeAt(0)
    return nextHash & nextHash
  }, 0)
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

function parseHoldingsEventFetchType(value: string | string[] | undefined): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | string[] | undefined): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
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

  try {
    await ensureSchemaInitialized()
  } catch (error) {
    console.error('Holdings PnL schema initialization error:', error)
    return res.status(500).json({ error: 'Failed to initialize holdings storage' })
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
      error: 'Holdings PnL API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const { address, version, unknownMode, fetchType: fetchTypeParam, paginationMode: paginationModeParam } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const paginationMode = parseHoldingsEventPaginationMode(paginationModeParam)

  try {
    const { getHoldingsPnL } = await import('../lib/holdings')
    const pnl = await getHoldingsPnL(
      address,
      version === 'v2' || version === 'v3' ? version : 'all',
      parseUnknownTransferInPnlMode(Array.isArray(unknownMode) ? unknownMode[0] : unknownMode),
      fetchType,
      paginationMode
    )

    if (pnl.summary.totalVaults === 0) {
      return res.status(404).json({ error: 'No holdings found for address' })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(pnl)
  } catch (error) {
    console.error('Holdings PnL error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return res.status(502).json({
        error: 'Failed to fetch holdings PnL',
        message,
        stack
      })
    }

    return res.status(502).json({ error: 'Failed to fetch holdings PnL' })
  }
}
