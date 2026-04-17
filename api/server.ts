import { serve } from 'bun'
import type {
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlyRevertRequest,
  TTenderlySnapshotRequest
} from '../src/components/shared/types/tenderly'
import {
  clearUserCache,
  deleteStaleCache,
  getHistoricalHoldings,
  getHoldingsBreakdown,
  getHoldingsPnL,
  getHoldingsPnLDrilldown,
  getHoldingsPnLSimple,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type HoldingsPnlEventScope,
  initializeSchema,
  isDatabaseEnabled,
  type UnknownTransferInPnlMode,
  type VaultVersion,
  validateConfig
} from './lib/holdings'
import { invalidateVaults, type VaultIdentifier } from './lib/holdings/services/cache'
import {
  createHoldingsDebugContext,
  debugError,
  debugLog,
  isHoldingsDebugRequested,
  withHoldingsDebugContext
} from './lib/holdings/services/debug'
import {
  buildTenderlyPanelStatus,
  buildTenderlyRevertResponse,
  buildTenderlySnapshotRecord,
  requireTenderlyServerChain,
  resolveTenderlyFundRpcRequest
} from './tenderly.helpers'
import { buildTenderlyAdminAccessDeniedResponse } from './tenderlyAccess'

const ENSO_API_BASE = 'https://api.enso.finance'
const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

type TTenderlyJsonRpcSuccess = {
  id: string | number | null
  jsonrpc: '2.0'
  result: unknown
}

type TTenderlyJsonRpcError = {
  id: string | number | null
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: unknown
  }
}

async function handleYvUsdAprs(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const requestUrl = new URL(req.url)
  const upstreamUrl = new URL(YVUSD_APR_SERVICE_API)
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value)
  })

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return Response.json(
        { error: 'yvUSD APR upstream error', status: response.status, details },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret'
}

function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}

function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

interface InvalidateRequestBody {
  vaults: Array<{ address: string; chainId: number }>
}

function validateInvalidateBody(body: unknown): body is InvalidateRequestBody {
  if (!body || typeof body !== 'object') return false
  const candidate = body as Record<string, unknown>
  if (!Array.isArray(candidate.vaults) || candidate.vaults.length === 0) return false

  for (const vault of candidate.vaults) {
    if (!vault || typeof vault !== 'object') return false
    const value = vault as Record<string, unknown>
    if (typeof value.address !== 'string' || !isValidAddress(value.address)) return false
    if (typeof value.chainId !== 'number' || !Number.isInteger(value.chainId)) return false
  }

  return true
}

function parseUnknownTransferInPnlMode(value: string | null): UnknownTransferInPnlMode {
  return value === 'strict' || value === 'zero_basis' || value === 'receipt_price' || value === 'windfall'
    ? value
    : 'windfall'
}

function parseHoldingsEventFetchType(value: string | null): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | null): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

function parseHoldingsPnlEventScope(value: string | null): HoldingsPnlEventScope {
  return value === 'address_only' ||
    value === 'address-only' ||
    value === 'none' ||
    value === 'disabled' ||
    value === 'off' ||
    value === 'false'
    ? 'address_only'
    : 'full'
}

function parseUtcDateParam(value: string | null): number | null {
  if (!value) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const timestamp = Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 1000)
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return timestamp
}

async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch (_error) {
    throw new Error('Invalid JSON body')
  }
}

async function callTenderlyAdminRpc(canonicalChainId: number, method: string, params: unknown[]): Promise<unknown> {
  const configuredChain = requireTenderlyServerChain(process.env, canonicalChainId)
  const response = await fetch(configuredChain.adminRpcUri as string, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params
    })
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Tenderly RPC request failed with status ${response.status}: ${details}`)
  }

  const payload = (await response.json()) as TTenderlyJsonRpcSuccess | TTenderlyJsonRpcError
  if ('error' in payload) {
    throw new Error(`${payload.error.message} (code ${payload.error.code})`)
  }

  return payload.result
}

function handleTenderlyStatus(req: Request): Response {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    return Response.json(buildTenderlyPanelStatus(process.env))
  } catch (error) {
    console.error('Error building Tenderly status:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to build Tenderly status' },
      { status: 500 }
    )
  }
}

async function handleTenderlySnapshot(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = await parseJsonBody<TTenderlySnapshotRequest>(req)
    const configuredChain = requireTenderlyServerChain(process.env, body.canonicalChainId)
    const snapshotId = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_snapshot', [])
    const snapshotRecord = buildTenderlySnapshotRecord({
      canonicalChainId: body.canonicalChainId,
      executionChainId: configuredChain.executionChainId,
      snapshotId: String(snapshotId),
      label: body.label,
      isBaseline: body.isBaseline
    })

    return Response.json(snapshotRecord)
  } catch (error) {
    console.error('Error creating Tenderly snapshot:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create Tenderly snapshot' },
      { status: 400 }
    )
  }
}

async function handleTenderlyRevert(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = await parseJsonBody<TTenderlyRevertRequest>(req)
    const result = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_revert', [body.snapshotId])

    return Response.json(buildTenderlyRevertResponse(result, body.snapshotId))
  } catch (error) {
    console.error('Error reverting Tenderly snapshot:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to revert Tenderly snapshot' },
      { status: 400 }
    )
  }
}

async function handleTenderlyIncreaseTime(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = await parseJsonBody<TTenderlyIncreaseTimeRequest>(req)
    if (!Number.isInteger(body.seconds) || body.seconds <= 0) {
      throw new Error('seconds must be a positive integer')
    }

    const timeResult = await callTenderlyAdminRpc(body.canonicalChainId, 'evm_increaseTime', [
      `0x${BigInt(body.seconds).toString(16)}`
    ])
    const mineResult = body.mineBlock ? await callTenderlyAdminRpc(body.canonicalChainId, 'evm_mine', []) : undefined

    return Response.json({
      timeResult,
      mineResult
    })
  } catch (error) {
    console.error('Error increasing Tenderly time:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to increase Tenderly time' },
      { status: 400 }
    )
  }
}

async function handleTenderlyFund(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = await parseJsonBody<TTenderlyFundRequest>(req)
    const { method, params } = resolveTenderlyFundRpcRequest(body)
    const result = await callTenderlyAdminRpc(body.canonicalChainId, method, params)

    return Response.json({
      method,
      result
    })
  } catch (error) {
    console.error('Error funding Tenderly wallet:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fund wallet on Tenderly' },
      { status: 400 }
    )
  }
}

function handleEnsoStatus(): Response {
  const apiKey = process.env.ENSO_API_KEY
  return Response.json({ configured: !!apiKey })
}

async function handleEnsoRoute(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const fromAddress = url.searchParams.get('fromAddress')
  const chainId = url.searchParams.get('chainId')
  const tokenIn = url.searchParams.get('tokenIn')
  const tokenOut = url.searchParams.get('tokenOut')
  const amountIn = url.searchParams.get('amountIn')
  const slippage = url.searchParams.get('slippage') || '100'
  const destinationChainId = url.searchParams.get('destinationChainId')
  const receiver = url.searchParams.get('receiver')

  if (!fromAddress || !chainId || !tokenIn || !tokenOut || !amountIn) {
    return Response.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return Response.json({ error: 'Enso API not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    fromAddress,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage
  })

  if (destinationChainId) {
    params.set('destinationChainId', destinationChainId)
  }
  if (receiver) {
    params.set('receiver', receiver)
  }

  const ensoUrl = `${ENSO_API_BASE}/api/v1/shortcuts/route?${params}`

  try {
    const response = await fetch(ensoUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json(data, { status: response.status })
    }

    return Response.json(data)
  } catch (error) {
    console.error('Error proxying Enso route request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleEnsoBalances(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const eoaAddress = url.searchParams.get('eoaAddress')
  const chainId = url.searchParams.get('chainId')

  if (!eoaAddress) {
    return Response.json({ error: 'Missing eoaAddress' }, { status: 400 })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return Response.json({ error: 'Enso API not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    eoaAddress,
    useEoa: 'true',
    chainId: chainId || 'all'
  })

  const ensoUrl = `${ENSO_API_BASE}/api/v1/wallet/balances?${params}`

  try {
    const response = await fetch(ensoUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Enso API error: ${response.status}`, errorText)
      return Response.json(
        { error: 'Enso API error', status: response.status, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Error proxying Enso request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleHoldingsHistory(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const refreshParam = url.searchParams.get('refresh')
  const refresh = refreshParam === 'true' || refreshParam === '1'

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    if (refresh) {
      const cleared = await clearUserCache(address, version)
      console.log(`[Server] Cleared ${cleared} cached entries for ${address}`)
    }

    const holdings = await withHoldingsDebugContext(
      createHoldingsDebugContext('history', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings history request', {
          version,
          fetchType,
          paginationMode,
          refresh,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHistoricalHoldings(address, version, fetchType, paginationMode)
          debugLog('route', 'completed holdings history request', {
            version,
            fetchType,
            paginationMode,
            refresh,
            points: response.dataPoints.length,
            nonZeroPoints: response.dataPoints.filter((point) => point.totalUsdValue > 0).length
          })
          return response
        } catch (error) {
          debugError('route', 'holdings history request failed', error, { version, fetchType, paginationMode })
          throw error
        }
      }
    )

    const hasHoldings = holdings.dataPoints.some((dp) => dp.totalUsdValue > 0)
    if (!hasHoldings) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(
      {
        address: holdings.address,
        version,
        dataPoints: holdings.dataPoints.map((dp) => ({
          date: dp.date,
          value: dp.totalUsdValue
        }))
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching holdings history:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch historical holdings', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsBreakdown(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const dateParam = url.searchParams.get('date')
  const versionParam = url.searchParams.get('version')
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const breakdownTimestamp = parseUtcDateParam(dateParam)
  if (dateParam && breakdownTimestamp === null) {
    return Response.json({ error: 'Invalid date format, expected YYYY-MM-DD', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const breakdown = await withHoldingsDebugContext(
      createHoldingsDebugContext('breakdown', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings breakdown request', {
          version,
          date: dateParam,
          fetchType,
          paginationMode,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHoldingsBreakdown(
            address,
            version,
            fetchType,
            paginationMode,
            breakdownTimestamp ?? undefined
          )
          debugLog('route', 'completed holdings breakdown request', {
            version,
            date: response.date,
            fetchType,
            paginationMode,
            timestamp: response.timestamp,
            totalVaults: response.summary.totalVaults,
            vaultsWithShares: response.summary.vaultsWithShares,
            totalUsdValue: response.summary.totalUsdValue
          })
          return response
        } catch (error) {
          debugError('route', 'holdings breakdown request failed', error, {
            version,
            date: dateParam,
            fetchType,
            paginationMode
          })
          throw error
        }
      }
    )

    return Response.json(breakdown, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings breakdown:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch holdings breakdown', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsPnL(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const unknownTransferInPnlMode = parseUnknownTransferInPnlMode(url.searchParams.get('unknownMode'))
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const eventScope = parseHoldingsPnlEventScope(
    url.searchParams.get('eventScope') ?? url.searchParams.get('enrichment')
  )

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const pnl = await withHoldingsDebugContext(
      createHoldingsDebugContext('pnl', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings pnl request', {
          version,
          unknownTransferInPnlMode,
          fetchType,
          paginationMode,
          eventScope,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHoldingsPnL(
            address,
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            eventScope
          )
          debugLog('route', 'completed holdings pnl request', {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            eventScope,
            totalVaults: response.summary.totalVaults,
            totalCurrentValueUsd: response.summary.totalCurrentValueUsd,
            totalPnlUsd: response.summary.totalPnlUsd,
            totalEconomicGainUsd: response.summary.totalEconomicGainUsd
          })
          return response
        } catch (error) {
          debugError('route', 'holdings pnl request failed', error, {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            eventScope
          })
          throw error
        }
      }
    )

    if (pnl.summary.totalVaults === 0) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(pnl, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings PnL:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch holdings PnL', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsPnLSimple(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const pnl = await withHoldingsDebugContext(
      createHoldingsDebugContext('pnl-simple', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings simple pnl request', {
          version,
          fetchType,
          paginationMode,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHoldingsPnLSimple(address, version, fetchType, paginationMode)
          debugLog('route', 'completed holdings simple pnl request', {
            version,
            fetchType,
            paginationMode,
            totalVaults: response.summary.totalVaults,
            baselineWeightUsd: response.summary.baselineWeightUsd,
            growthWeightUsd: response.summary.growthWeightUsd,
            protocolReturnPct: response.summary.protocolReturnPct
          })
          return response
        } catch (error) {
          debugError('route', 'holdings simple pnl request failed', error, {
            version,
            fetchType,
            paginationMode
          })
          throw error
        }
      }
    )

    if (pnl.summary.totalVaults === 0) {
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    return Response.json(pnl, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings simple PnL:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch holdings simple PnL', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsPnLDrilldown(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const vault = url.searchParams.get('vault')
  const versionParam = url.searchParams.get('version')
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault') ?? vault
  const debugTx = url.searchParams.get('debugTx')
  const unknownTransferInPnlMode = parseUnknownTransferInPnlMode(url.searchParams.get('unknownMode'))
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const eventScope = parseHoldingsPnlEventScope(
    url.searchParams.get('eventScope') ?? url.searchParams.get('enrichment')
  )

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  if (vault !== null && !isValidAddress(vault)) {
    return Response.json({ error: 'Invalid vault address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const pnl = await withHoldingsDebugContext(
      createHoldingsDebugContext('pnl', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx
      }),
      async () => {
        debugLog('route', 'started holdings pnl drilldown request', {
          version,
          unknownTransferInPnlMode,
          fetchType,
          paginationMode,
          eventScope,
          vault: vault?.toLowerCase() ?? null,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
        })

        try {
          const response = await getHoldingsPnLDrilldown(
            address,
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            vault,
            eventScope
          )
          debugLog('route', 'completed holdings pnl drilldown request', {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            eventScope,
            vault: vault?.toLowerCase() ?? null,
            totalVaults: response.summary.totalVaults,
            totalCurrentValueUsd: response.summary.totalCurrentValueUsd,
            totalPnlUsd: response.summary.totalPnlUsd,
            totalEconomicGainUsd: response.summary.totalEconomicGainUsd
          })
          return response
        } catch (error) {
          debugError('route', 'holdings pnl drilldown request failed', error, {
            version,
            unknownTransferInPnlMode,
            fetchType,
            paginationMode,
            eventScope,
            vault: vault?.toLowerCase() ?? null
          })
          throw error
        }
      }
    )

    if (pnl.summary.totalVaults === 0) {
      return Response.json(
        {
          error: vault ? 'No matching holdings found for address and vault' : 'No holdings found for address',
          status: 404
        },
        { status: 404 }
      )
    }

    return Response.json(pnl, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings PnL drilldown:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json(
      { error: 'Failed to fetch holdings PnL drilldown', message, stack, status: 502 },
      { status: 502 }
    )
  }
}

async function handleHoldingsChores(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Chores] CRON_SECRET not configured')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initializeSchema()
    const deletedCount = await deleteStaleCache()

    return Response.json({
      success: true,
      deletedRows: deletedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Chores] Failed to run cleanup:', error)
    return Response.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}

async function handleInvalidateCache(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return Response.json({ error: 'Admin endpoint not configured' }, { status: 503 })
  }

  const providedSecret = req.headers.get('x-admin-secret')
  if (providedSecret !== adminSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseEnabled()) {
    return Response.json({ error: 'Caching not enabled (DATABASE_URL not configured)' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch (_error) {
    return Response.json(
      {
        error: 'Invalid request body',
        expected: { vaults: [{ address: '0x...', chainId: 1 }] }
      },
      { status: 400 }
    )
  }

  if (!validateInvalidateBody(body)) {
    return Response.json(
      {
        error: 'Invalid request body',
        expected: { vaults: [{ address: '0x...', chainId: 1 }] }
      },
      { status: 400 }
    )
  }

  try {
    const vaults: VaultIdentifier[] = body.vaults.map((vault) => ({
      address: vault.address,
      chainId: vault.chainId
    }))

    const invalidatedCount = await invalidateVaults(vaults)

    return Response.json({
      success: true,
      invalidated: invalidatedCount,
      vaults: vaults.map((vault) => `${vault.chainId}:${vault.address.toLowerCase()}`),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Admin] Invalidate cache error:', error)
    return Response.json({ error: 'Failed to invalidate cache' }, { status: 500 })
  }
}

async function main() {
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  })

  validateConfig()

  await initializeSchema()

  serve({
    async fetch(req, server) {
      const url = new URL(req.url)
      console.log(`[Server] ${req.method} ${url.pathname}`)

      try {
        if (req.method === 'OPTIONS') {
          return handleCorsPreFlight()
        }

        if (url.pathname === '/api/enso/status') {
          return withCors(handleEnsoStatus())
        }

        if (url.pathname === '/api/enso/balances') {
          return withCors(await handleEnsoBalances(req))
        }

        if (url.pathname === '/api/enso/route') {
          return withCors(await handleEnsoRoute(req))
        }

        if (url.pathname === '/api/holdings/history') {
          return withCors(await handleHoldingsHistory(req))
        }

        if (url.pathname === '/api/holdings/breakdown') {
          return withCors(await handleHoldingsBreakdown(req))
        }

        if (url.pathname === '/api/holdings/pnl/drilldown') {
          return withCors(await handleHoldingsPnLDrilldown(req))
        }

        if (url.pathname === '/api/holdings/pnl/simple') {
          return withCors(await handleHoldingsPnLSimple(req))
        }

        if (url.pathname === '/api/holdings/pnl') {
          return withCors(await handleHoldingsPnL(req))
        }

        if (url.pathname === '/api/holdings/chores') {
          return withCors(await handleHoldingsChores(req))
        }

        if (url.pathname === '/api/admin/invalidate-cache') {
          return withCors(await handleInvalidateCache(req))
        }

        if (url.pathname === '/api/yvusd/aprs') {
          return withCors(await handleYvUsdAprs(req))
        }

        if (url.pathname === '/api/tenderly/status') {
          return withCors(handleTenderlyStatus(req))
        }

        if (url.pathname === '/api/tenderly/snapshot') {
          const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
          if (accessDeniedResponse) {
            return withCors(accessDeniedResponse)
          }
          return withCors(await handleTenderlySnapshot(req))
        }

        if (url.pathname === '/api/tenderly/revert') {
          const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
          if (accessDeniedResponse) {
            return withCors(accessDeniedResponse)
          }
          return withCors(await handleTenderlyRevert(req))
        }

        if (url.pathname === '/api/tenderly/increase-time') {
          const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
          if (accessDeniedResponse) {
            return withCors(accessDeniedResponse)
          }
          return withCors(await handleTenderlyIncreaseTime(req))
        }

        if (url.pathname === '/api/tenderly/fund') {
          const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
          if (accessDeniedResponse) {
            return withCors(accessDeniedResponse)
          }
          return withCors(await handleTenderlyFund(req))
        }

        return withCors(new Response('Not found', { status: 404 }))
      } catch (error) {
        console.error('💥 Request handler error:', error)
        return withCors(
          Response.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
            { status: 500 }
          )
        )
      }
    },
    port: 3001,
    idleTimeout: 120
  })

  console.log('🚀 API server running on http://localhost:3001')
  console.log('📊 Holdings API: http://localhost:3001/api/holdings/history?address=0x...')
  console.log('🧩 Holdings Breakdown API: http://localhost:3001/api/holdings/breakdown?address=0x...')
  console.log('💹 PnL API: http://localhost:3001/api/holdings/pnl?address=0x...')
  console.log('📈 Simple PnL API: http://localhost:3001/api/holdings/pnl/simple?address=0x...')
  console.log('🧾 PnL Drilldown API: http://localhost:3001/api/holdings/pnl/drilldown?address=0x...')
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
