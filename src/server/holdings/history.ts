import { GET_CORS_HEADERS, json, noContent, queryValue } from '../http'
import type {
  HoldingsEventFetchType,
  HoldingsEventPaginationMode,
  HoldingsHistoryDenomination,
  HoldingsHistoryTimeframe,
  VaultVersion
} from '../lib/holdings'
import { ensureHoldingsStorageInitialized } from '../lib/holdings'
import {
  createHoldingsDebugContext,
  debugError,
  debugLog,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from '../lib/holdings/services/debug'
import { startHoldingsProgress, updateHoldingsProgress } from '../lib/holdings/services/progress'

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

function parseHoldingsHistoryDenomination(value: string | string[] | undefined): HoldingsHistoryDenomination {
  return value === 'eth' ? 'eth' : 'usd'
}

function parseHoldingsHistoryTimeframe(value: string | string[] | undefined): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    await ensureHoldingsStorageInitialized()
  } catch (error) {
    console.error('Holdings history storage initialization error:', error)
    return json({ error: 'Failed to initialize holdings storage' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  // Check if Envio is configured
  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return json(
      {
        error: 'Holdings history API not configured',
        details: 'ENVIO_GRAPHQL_URL environment variable is not set. This feature requires a running Envio indexer.'
      },
      { status: 503, headers: GET_CORS_HEADERS }
    )
  }

  const address = queryValue(request, 'address')
  const chainIdParam = queryValue(request, 'chainId')
  const vaultParam = queryValue(request, 'vault')
  const vaultsParam = queryValue(request, 'vaults')
  const versionParam = queryValue(request, 'version')
  const fetchTypeParam = queryValue(request, 'fetchType')
  const paginationModeParam = queryValue(request, 'paginationMode')
  const denominationParam = queryValue(request, 'denomination')
  const timeframeParam = queryValue(request, 'timeframe')
  const debugParam = queryValue(request, 'debug')
  const progressIdParam = queryValue(request, 'progressId')

  if (!address || typeof address !== 'string') {
    return json({ error: 'Missing required parameter: address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  if (!isValidAddress(address)) {
    return json({ error: 'Invalid Ethereum address' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const vaultFilters = parseVaultFilters({
    vault: vaultParam,
    chainId: chainIdParam,
    vaults: vaultsParam
  })

  if (vaultFilters === null) {
    return json({ error: 'Invalid vault filter' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'
  const fetchType = parseHoldingsEventFetchType(fetchTypeParam)
  const paginationMode = parseHoldingsEventPaginationMode(paginationModeParam)
  const denomination = parseHoldingsHistoryDenomination(denominationParam)
  const timeframe = parseHoldingsHistoryTimeframe(timeframeParam)
  const progressId = typeof progressIdParam === 'string' ? progressIdParam : null
  const debugEnabled = isHoldingsDebugRequested(typeof debugParam === 'string' ? debugParam : null)

  try {
    const activeProgressId = await startHoldingsProgress({
      id: progressId,
      route: 'history',
      address,
      message: 'Fetching historical user data'
    })
    await updateHoldingsProgress(activeProgressId, {
      progress: 8,
      message: 'Fetching historical user data',
      detail: null
    })
    const { getHistoricalHoldingsChart } = await import('../lib/holdings')
    const holdings = await withHoldingsDebugContext(
      createHoldingsDebugContext('history', address, debugEnabled, {
        progressId: activeProgressId
      }),
      async () => {
        debugLog('route', 'started holdings history request', {
          version,
          fetchType,
          paginationMode,
          denomination,
          timeframe
        })

        try {
          const response = await getHistoricalHoldingsChart(
            address,
            version,
            fetchType,
            paginationMode,
            denomination,
            timeframe,
            vaultFilters
          )
          debugLog('route', 'completed holdings history request', {
            version,
            fetchType,
            paginationMode,
            denomination,
            timeframe,
            points: response.dataPoints.length
          })
          return response
        } catch (error) {
          debugError('route', 'holdings history request failed', error, { version, fetchType, paginationMode })
          throw error
        }
      }
    )

    if (!holdings.hasActivity) {
      await updateHoldingsProgress(activeProgressId, {
        status: 'complete',
        progress: 100,
        message: 'No historical holdings found',
        detail: null
      })
      return json({ error: 'No holdings found for address' }, { status: 404, headers: GET_CORS_HEADERS })
    }

    await updateHoldingsProgress(activeProgressId, {
      status: 'complete',
      progress: 100,
      message: 'Historical user data ready',
      detail: `${holdings.dataPoints.length} chart points`
    })

    return json(
      {
        address: holdings.address,
        version,
        denomination,
        timeframe,
        dataPoints: holdings.dataPoints.map((dp) => ({
          date: dp.date,
          value: dp.value
        }))
      },
      {
        headers: {
          ...GET_CORS_HEADERS,
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error) {
    await updateHoldingsProgress(progressId, {
      status: 'error',
      message: 'Failed to fetch historical user data',
      detail: error instanceof Error ? error.message : String(error)
    })
    console.error('Holdings history error:', error)

    if (process.env.NODE_ENV === 'development') {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      return json(
        {
          error: 'Failed to fetch historical holdings',
          message,
          stack
        },
        { status: 502, headers: GET_CORS_HEADERS }
      )
    }

    return json({ error: 'Failed to fetch historical holdings' }, { status: 502, headers: GET_CORS_HEADERS })
  }
}

export default GET
