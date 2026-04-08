import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { HoldingsEventFetchType, HoldingsEventPaginationMode, VaultVersion } from '../lib/holdings'
import { checkRateLimit, ensureSchemaInitialized } from '../lib/holdings'

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

function parseHoldingsEventFetchType(value: string | string[] | undefined): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | string[] | undefined): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

function parseUtcDateParam(value: string | string[] | undefined): number | null {
  if (!value || Array.isArray(value)) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const timestamp = Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 1000)
  return Number.isFinite(timestamp) ? timestamp : null
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
    console.error('Holdings breakdown schema initialization error:', error)
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
      error: 'Holdings breakdown API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const {
    address,
    date: dateParam,
    version: versionParam,
    fetchType: fetchTypeParam,
    paginationMode: paginationModeParam
  } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  const breakdownTimestamp = parseUtcDateParam(dateParam)
  if (dateParam && breakdownTimestamp === null) {
    return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'
  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const paginationMode = parseHoldingsEventPaginationMode(paginationModeParam)

  try {
    const { getHoldingsBreakdown } = await import('../lib/holdings')
    const breakdown = await getHoldingsBreakdown(
      address,
      version,
      fetchType,
      paginationMode,
      breakdownTimestamp ?? undefined
    )

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(breakdown)
  } catch (error) {
    console.error('Holdings breakdown error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return res.status(502).json({
        error: 'Failed to fetch holdings breakdown',
        message,
        stack
      })
    }

    return res.status(502).json({ error: 'Failed to fetch holdings breakdown' })
  }
}
