import type { VercelRequest, VercelResponse } from '@vercel/node'
import type {
  HoldingsEventFetchType,
  HoldingsEventPaginationMode,
  HoldingsHistoryTimeframe,
  VaultVersion
} from '../../lib/holdings'
import { checkRateLimit, ensureHoldingsStorageInitialized } from '../../lib/holdings'
import {
  createHoldingsDebugContext,
  debugError,
  debugLog,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from '../../lib/holdings/services/debug'
import { startHoldingsProgress, updateHoldingsProgress } from '../../lib/holdings/services/progress'

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

function parseVaultFilters({
  vault,
  chainId,
  vaults
}: {
  vault: string | string[] | undefined
  chainId: string | string[] | undefined
  vaults: string | string[] | undefined
}): Array<{ chainId: number; vaultAddress: string }> | null | undefined {
  if (vaults !== undefined) {
    if (typeof vaults !== 'string') {
      return null
    }

    const entries = vaults
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const parsedEntries = entries.map((entry) => {
      const [entryChainId, entryVaultAddress] = entry.split(':')
      const parsedChainId = Number(entryChainId)

      if (
        !entryChainId ||
        !entryVaultAddress ||
        !Number.isInteger(parsedChainId) ||
        !isValidAddress(entryVaultAddress)
      ) {
        return null
      }

      return { chainId: parsedChainId, vaultAddress: entryVaultAddress }
    })

    if (parsedEntries.some((entry) => entry === null)) {
      return null
    }

    return parsedEntries.filter((entry): entry is { chainId: number; vaultAddress: string } => entry !== null)
  }

  if (vault === undefined) {
    return undefined
  }

  if (typeof vault !== 'string' || !isValidAddress(vault)) {
    return null
  }

  if (!chainId || typeof chainId !== 'string' || !Number.isInteger(Number(chainId))) {
    return null
  }

  return [{ chainId: Number(chainId), vaultAddress: vault }]
}

function parseHoldingsEventFetchType(value: string | string[] | undefined): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | string[] | undefined): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

function parseHoldingsHistoryTimeframe(value: string | string[] | undefined): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
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
    console.error('Holdings protocol return history storage initialization error:', error)
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
      error: 'Holdings protocol return history API not configured',
      details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
    })
  }

  const {
    address,
    chainId: chainIdParam,
    vault: vaultParam,
    vaults: vaultsParam,
    version: versionParam,
    fetchType: fetchTypeParam,
    paginationMode: paginationModeParam,
    timeframe: timeframeParam,
    debug: debugParam,
    progressId: progressIdParam
  } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: address' })
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  const vaultFilters = parseVaultFilters({
    vault: vaultParam,
    chainId: chainIdParam,
    vaults: vaultsParam
  })

  if (vaultFilters === null) {
    return res.status(400).json({ error: 'Invalid vault filter' })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'
  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const paginationMode = parseHoldingsEventPaginationMode(paginationModeParam)
  const timeframe = parseHoldingsHistoryTimeframe(timeframeParam)
  const progressId = typeof progressIdParam === 'string' ? progressIdParam : null
  const debugEnabled = isHoldingsDebugRequested(typeof debugParam === 'string' ? debugParam : null)
  let activeProgressId: string | null = null

  try {
    activeProgressId = await startHoldingsProgress({
      id: progressId,
      route: 'pnl-simple-history',
      address,
      message: 'Fetching historical user data'
    })
    await updateHoldingsProgress(activeProgressId, {
      progress: 8,
      message: 'Fetching historical user data',
      detail: null
    })
    const { getHoldingsProtocolReturnHistory } = await import('../../lib/holdings')
    const history = await withHoldingsDebugContext(
      createHoldingsDebugContext('protocol-return-history', address, debugEnabled, {
        progressId: activeProgressId
      }),
      async () => {
        debugLog('route', 'started holdings protocol return history request', {
          version,
          timeframe,
          fetchType,
          paginationMode
        })

        try {
          const response = await getHoldingsProtocolReturnHistory(
            address,
            version,
            fetchType,
            paginationMode,
            timeframe,
            vaultFilters
          )
          debugLog('route', 'completed holdings protocol return history request', {
            version,
            timeframe,
            fetchType,
            paginationMode,
            totalVaults: response.summary.totalVaults,
            points: response.dataPoints.length
          })
          return response
        } catch (error) {
          debugError('route', 'holdings protocol return history request failed', error, {
            version,
            timeframe,
            fetchType,
            paginationMode
          })
          throw error
        }
      }
    )

    if (history.summary.totalVaults === 0) {
      await updateHoldingsProgress(activeProgressId, {
        status: 'complete',
        progress: 100,
        message: 'No historical holdings found',
        detail: null
      })
      return res.status(404).json({ error: 'No holdings found for address' })
    }

    await updateHoldingsProgress(activeProgressId, {
      status: 'complete',
      progress: 100,
      message: 'Historical user data ready',
      detail: `${history.dataPoints.length} chart points`
    })

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(history)
  } catch (error) {
    await updateHoldingsProgress(activeProgressId, {
      status: 'error',
      message: 'Failed to fetch historical user data',
      detail: error instanceof Error ? error.message : String(error)
    })
    console.error('Holdings protocol return history error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return res.status(502).json({
        error: 'Failed to fetch holdings protocol return history',
        message,
        stack
      })
    }

    return res.status(502).json({ error: 'Failed to fetch holdings protocol return history' })
  }
}
