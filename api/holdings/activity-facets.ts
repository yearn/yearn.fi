import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { VaultVersion } from '../lib/holdings'
import { checkRateLimit, ensureHoldingsStorageInitialized } from '../lib/holdings'

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

function parseVersion(value: string | string[] | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

function parsePositiveInteger(value: string | string[] | undefined, fallback: number, max: number): number {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsedValue = Number(rawValue)

  return Number.isInteger(parsedValue) && parsedValue > 0 ? Math.min(parsedValue, max) : fallback
}

function parseNonNegativeInteger(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value
  const parsedValue = Number(rawValue)

  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : 0
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
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings activity facets storage initialization error:', error)
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
      error: 'Holdings activity API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const {
    address,
    version: versionParam,
    limitPerSource: limitPerSourceParam,
    offsetPerSource: offsetPerSourceParam
  } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  try {
    const { fetchRecentAddressScopedActivityEvents } = await import('../lib/holdings')
    const version = parseVersion(versionParam)
    const limitPerSource = parsePositiveInteger(limitPerSourceParam, 250, 1000)
    const offsetPerSource = parseNonNegativeInteger(offsetPerSourceParam)
    const events = await fetchRecentAddressScopedActivityEvents(
      address,
      version,
      limitPerSource,
      undefined,
      offsetPerSource
    )
    const hasMore =
      events.hasMoreDeposits || events.hasMoreWithdrawals || events.hasMoreTransfersIn || events.hasMoreTransfersOut
    const chainIds = Array.from(
      new Set(
        [...events.deposits, ...events.withdrawals, ...events.transfersIn, ...events.transfersOut].map(
          (event) => event.chainId
        )
      )
    ).sort((firstChainId, secondChainId) => firstChainId - secondChainId)

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')
    return res.status(200).json({
      address: address.toLowerCase(),
      version,
      facets: { chainIds },
      pageInfo: {
        hasMore,
        nextOffsetPerSource: hasMore ? offsetPerSource + limitPerSource : null
      }
    })
  } catch (error) {
    console.error('Holdings activity facets error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return res.status(502).json({
        error: 'Failed to fetch holdings activity facets',
        message,
        stack
      })
    }

    return res.status(502).json({ error: 'Failed to fetch holdings activity facets' })
  }
}
