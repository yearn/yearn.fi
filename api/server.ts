import { serve } from 'bun'
import type {
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlyRevertRequest,
  TTenderlySnapshotRequest
} from '../src/components/shared/types/tenderly'
import { ENSO_BALANCES_CACHE_CONTROL } from './enso/cache'
import {
  clearUserCache,
  getHistoricalHoldingsChart,
  getHoldingsActivity,
  getHoldingsBreakdown,
  getHoldingsProtocolReturnHistory,
  getHoldingsTotalsCacheVersion,
  type HoldingsActivityTypeFilter,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type HoldingsHistoryDenomination,
  type HoldingsHistoryTimeframe,
  initializeSchema,
  isDatabaseEnabled,
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
import { fetchRecentAddressScopedActivityEvents } from './lib/holdings/services/graphql'
import { getHoldingsProgress, startHoldingsProgress, updateHoldingsProgress } from './lib/holdings/services/progress'
import { parseVaultStateStrategies } from './optimization/_lib/address'
import { getVaultDecimals } from './optimization/_lib/assetLogos'
import { fetchAlignedEvents } from './optimization/_lib/envio'
import { parseExplainMetadata } from './optimization/_lib/explain-parse'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
  REDIS_AUTHENTICATION_ERROR_MESSAGE,
  REDIS_CONNECTIVITY_ERROR_MESSAGE,
  readOptimizations
} from './optimization/_lib/redis'
import { fetchVaultOnChainState } from './optimization/_lib/rpc'
import {
  buildTenderlyPanelStatus,
  buildTenderlyRevertResponse,
  buildTenderlySnapshotRecord,
  requireTenderlyServerChain,
  resolveTenderlyFundRpcRequest
} from './tenderly.helpers'
import { buildTenderlyAdminAccessDeniedResponse } from './tenderlyAccess'

const ENSO_API_BASE = 'https://api.enso.finance'
const DEFAULT_API_PORT = 3001
const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

function isHistoryQueryEnabled(historyParam: string | null): boolean {
  return historyParam === '1' || historyParam === 'true'
}

function resolveApiPort(env: NodeJS.ProcessEnv): number {
  const rawPort = env.API_PORT?.trim() || env.API_SERVER_PORT?.trim() || String(DEFAULT_API_PORT)
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid API port value: ${rawPort}`)
  }

  return port
}

const API_PORT = resolveApiPort(process.env)

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

async function handleHoldingsProgress(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const progress = await getHoldingsProgress(url.searchParams.get('id'))

  if (!progress) {
    return Response.json({ error: 'Progress not found', status: 404 }, { status: 404 })
  }

  return Response.json(progress, {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function parseVaultFilters(url: URL): Array<{ chainId: number; vaultAddress: string }> | null | undefined {
  const vaults = url.searchParams.get('vaults')

  if (vaults !== null) {
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

  const vault = url.searchParams.get('vault')
  if (vault === null) {
    return undefined
  }

  const chainId = url.searchParams.get('chainId')
  if (!isValidAddress(vault) || !chainId || !Number.isInteger(Number(chainId))) {
    return null
  }

  return [{ chainId: Number(chainId), vaultAddress: vault }]
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

function parseHoldingsEventFetchType(value: string | null): HoldingsEventFetchType {
  return value === 'parallel' ? 'parallel' : 'seq'
}

function parseHoldingsEventPaginationMode(value: string | null): HoldingsEventPaginationMode {
  return value === 'all' ? 'all' : 'paged'
}

function parseHoldingsHistoryDenomination(value: string | null): HoldingsHistoryDenomination {
  return value === 'eth' ? 'eth' : 'usd'
}

function parseHoldingsHistoryTimeframe(value: string | null): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
}

function parseHoldingsActivityLimit(value: string | null): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return 10
  }

  return Math.min(Math.max(parsed, 1), 50)
}

function parseHoldingsActivityOffset(value: string | null): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return 0
  }

  return Math.max(parsed, 0)
}

function parseHoldingsActivityType(value: string | null): HoldingsActivityTypeFilter {
  return value === 'deposit' ||
    value === 'withdraw' ||
    value === 'stake' ||
    value === 'unstake' ||
    value === 'transfer' ||
    value === 'swap'
    ? value
    : 'all'
}

function parseHoldingsActivityChainId(value: string | null): number | null {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseHoldingsActivityTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function parseHoldingsActivityBoolean(value: string | null): boolean {
  return value === 'true' || value === '1'
}

function parsePositiveIntegerParam(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function parseNonNegativeIntegerParam(value: string | null): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
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
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const utcDate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))

  if (
    utcDate.getUTCFullYear() !== yearNumber ||
    utcDate.getUTCMonth() !== monthNumber - 1 ||
    utcDate.getUTCDate() !== dayNumber
  ) {
    return null
  }

  const timestamp = Math.floor(utcDate.getTime() / 1000)
  return Number.isFinite(timestamp) ? timestamp : null
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
  const routingStrategy = url.searchParams.get('routingStrategy')
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
  if (routingStrategy) {
    params.set('routingStrategy', routingStrategy)
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
        'Cache-Control': ENSO_BALANCES_CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Error proxying Enso request:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const CHANGE_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'
const ALIGNMENT_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'
const VAULT_STATE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

async function handleOptimizationChange(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return Response.json({ error: 'No optimization data available' }, { status: 404 })
    }

    const url = new URL(req.url)
    const requestedVault = url.searchParams.get('vault')
    if (requestedVault) {
      if (isHistoryQueryEnabled(url.searchParams.get('history'))) {
        const selectedHistory = optimizations.filter((optimization) => {
          return optimization.vault.toLowerCase() === requestedVault.toLowerCase()
        })
        if (selectedHistory.length === 0) {
          return Response.json({ error: `Vault not found in optimization payload: ${requestedVault}` }, { status: 404 })
        }

        return Response.json(selectedHistory, {
          headers: {
            'Cache-Control': CHANGE_CACHE_CONTROL
          }
        })
      }

      const selected = findVaultOptimization(optimizations, requestedVault)
      if (!selected) {
        return Response.json({ error: `Vault not found in optimization payload: ${requestedVault}` }, { status: 404 })
      }

      return Response.json(selected, {
        headers: {
          'Cache-Control': CHANGE_CACHE_CONTROL
        }
      })
    }

    return Response.json(optimizations, {
      headers: {
        'Cache-Control': CHANGE_CACHE_CONTROL
      }
    })
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return Response.json({ error: REDIS_AUTHENTICATION_ERROR_MESSAGE }, { status: 500 })
    }

    if (isRedisConnectivityError(error)) {
      return Response.json({ error: REDIS_CONNECTIVITY_ERROR_MESSAGE }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

async function handleOptimizationAlignment(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url = new URL(req.url)
  const vault = url.searchParams.get('vault')
  if (!vault) {
    return Response.json({ error: 'vault parameter required' }, { status: 400 })
  }

  const envioUrl = process.env.ENVIO_GRAPHQL_URL
  if (!envioUrl) {
    return Response.json({ error: 'ENVIO_GRAPHQL_URL not configured' }, { status: 503 })
  }

  try {
    const optimizations = await readOptimizations()
    if (!optimizations || optimizations.length === 0) {
      return Response.json({ error: 'No optimization data available' }, { status: 404 })
    }

    const optimization = findVaultOptimization(optimizations, vault)
    if (!optimization) {
      return Response.json({ error: `Vault not found: ${vault}` }, { status: 404 })
    }

    const metadataChainId = optimization.source.chainId ? undefined : parseExplainMetadata(optimization.explain).chainId
    const chainId = optimization.source.chainId ?? metadataChainId
    if (!chainId) {
      return Response.json({ error: 'Could not determine chain ID for vault' }, { status: 400 })
    }

    const timestampStr = optimization.source.latestMatchedTimestampUtc ?? optimization.source.timestampUtc
    if (!timestampStr) {
      return Response.json({ error: 'No timestamp available for vault snapshot' }, { status: 400 })
    }

    const fromTs = Math.floor(new Date(timestampStr.replace(' UTC', 'Z').replace(' ', 'T')).getTime() / 1000)
    const numStrategies = optimization.strategyDebtRatios.length
    const toTs = fromTs + numStrategies * 10 * 60 * 2
    const decimals = getVaultDecimals(vault)
    const events = await fetchAlignedEvents(
      envioUrl,
      vault,
      chainId,
      optimization.strategyDebtRatios,
      fromTs,
      toTs,
      decimals
    )

    return Response.json(events, {
      headers: {
        'Cache-Control': ALIGNMENT_CACHE_CONTROL
      }
    })
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return Response.json({ error: REDIS_AUTHENTICATION_ERROR_MESSAGE }, { status: 500 })
    }

    if (isRedisConnectivityError(error)) {
      return Response.json({ error: REDIS_CONNECTIVITY_ERROR_MESSAGE }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

async function handleOptimizationVaultState(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null
  const strategyResult = parseVaultStateStrategies(payload.strategies)

  if (!vault || !isValidAddress(vault)) {
    return Response.json({ error: 'Invalid vault address' }, { status: 400 })
  }

  if (chainId === null || !Number.isFinite(chainId)) {
    return Response.json({ error: 'Invalid chainId' }, { status: 400 })
  }

  if ('error' in strategyResult) {
    return Response.json({ error: strategyResult.error }, { status: 400 })
  }

  try {
    const state = await fetchVaultOnChainState(chainId, vault, strategyResult.strategies)
    const strategyDebts = Object.fromEntries(
      [...state.strategyDebts].map(([strategyAddress, debt]) => [strategyAddress, debt.toString()])
    )

    return Response.json(
      {
        totalAssets: state.totalAssets.toString(),
        strategyDebts,
        unallocatedBps: state.unallocatedBps
      },
      {
        headers: {
          'Cache-Control': VAULT_STATE_CACHE_CONTROL
        }
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 503 })
  }
}

async function handleHoldingsHistory(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const denomination = parseHoldingsHistoryDenomination(url.searchParams.get('denomination'))
  const timeframe = parseHoldingsHistoryTimeframe(url.searchParams.get('timeframe'))
  const vaultFilters = parseVaultFilters(url)
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const refreshParam = url.searchParams.get('refresh')
  const progressId = url.searchParams.get('progressId')
  const refresh = refreshParam === 'true' || refreshParam === '1'

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  if (vaultFilters === null) {
    return Response.json({ error: 'Invalid vault filter', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

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

    if (refresh) {
      const cleared = await clearUserCache(address, getHoldingsTotalsCacheVersion(version))
      console.log(`[Server] Cleared ${cleared} cached entries for ${address}`)
    }

    const holdings = await withHoldingsDebugContext(
      createHoldingsDebugContext('history', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx,
        progressId: activeProgressId
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
            refresh,
            points: response.dataPoints.length,
            nonZeroPoints: response.dataPoints.filter((point) => point.value > 0).length
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
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    await updateHoldingsProgress(activeProgressId, {
      status: 'complete',
      progress: 100,
      message: 'Historical user data ready',
      detail: `${holdings.dataPoints.length} chart points`
    })

    return Response.json(
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
    console.error('Error fetching holdings history:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch historical holdings', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsActivity(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const limit = parseHoldingsActivityLimit(url.searchParams.get('limit'))
  const offset = parseHoldingsActivityOffset(url.searchParams.get('offset'))
  const type = parseHoldingsActivityType(url.searchParams.get('type'))
  const chainId = parseHoldingsActivityChainId(url.searchParams.get('chainId'))
  const startTimestamp = parseHoldingsActivityTimestamp(url.searchParams.get('startTimestamp'))
  const endTimestamp = parseHoldingsActivityTimestamp(url.searchParams.get('endTimestamp'))
  const includeFacets = parseHoldingsActivityBoolean(url.searchParams.get('includeFacets'))

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const activity = await getHoldingsActivity(
      address,
      version,
      limit,
      offset,
      {
        type,
        chainId,
        startTimestamp,
        endTimestamp
      },
      includeFacets
    )

    return Response.json(activity, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Error fetching holdings activity:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json({ error: 'Failed to fetch holdings activity', message, stack, status: 502 }, { status: 502 })
  }
}

async function handleHoldingsActivityFacets(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const limitPerSource = parsePositiveIntegerParam(url.searchParams.get('limitPerSource'), 250, 1000)
  const offsetPerSource = parseNonNegativeIntegerParam(url.searchParams.get('offsetPerSource'))

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
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

    return Response.json(
      {
        address: address.toLowerCase(),
        version,
        facets: { chainIds },
        pageInfo: {
          hasMore,
          nextOffsetPerSource: hasMore ? offsetPerSource + limitPerSource : null
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching holdings activity facets:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json(
      { error: 'Failed to fetch holdings activity facets', message, stack, status: 502 },
      { status: 502 }
    )
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

async function handleHoldingsProtocolReturnHistory(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')
  const versionParam = url.searchParams.get('version')
  const vaultFilters = parseVaultFilters(url)
  const timeframe = parseHoldingsHistoryTimeframe(url.searchParams.get('timeframe'))
  const debugEnabled =
    isHoldingsDebugRequested(url.searchParams.get('debug')) || isHoldingsDebugRequested(process.env.HOLDINGS_DEBUG)
  const debugLotsEnabled = isHoldingsDebugRequested(url.searchParams.get('debugLots'))
  const debugVault = url.searchParams.get('debugVault')
  const debugTx = url.searchParams.get('debugTx')
  const fetchType = parseHoldingsEventFetchType(url.searchParams.get('fetchType'))
  const paginationMode = parseHoldingsEventPaginationMode(url.searchParams.get('paginationMode'))
  const progressId = url.searchParams.get('progressId')

  if (!address) {
    return Response.json({ error: 'Missing required parameter: address', status: 400 }, { status: 400 })
  }

  if (!isValidAddress(address)) {
    return Response.json({ error: 'Invalid Ethereum address', status: 400 }, { status: 400 })
  }

  if (vaultFilters === null) {
    return Response.json({ error: 'Invalid vault filter', status: 400 }, { status: 400 })
  }

  const version: VaultVersion = versionParam === 'v2' || versionParam === 'v3' ? versionParam : 'all'

  try {
    const activeProgressId = await startHoldingsProgress({
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

    const history = await withHoldingsDebugContext(
      createHoldingsDebugContext('protocol-return-history', address, debugEnabled, {
        lotsEnabled: debugLotsEnabled,
        vaultFilter: debugVault,
        txFilter: debugTx,
        progressId: activeProgressId
      }),
      async () => {
        debugLog('route', 'started holdings protocol return history request', {
          version,
          timeframe,
          vaults: vaultFilters?.map((vault) => `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`) ?? null,
          fetchType,
          paginationMode,
          debugLotsEnabled,
          debugVault: debugVault?.toLowerCase() ?? null,
          debugTx: debugTx?.toLowerCase() ?? null
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
            vaults: vaultFilters?.map((vault) => `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`) ?? null,
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
            vaults: vaultFilters?.map((vault) => `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`) ?? null,
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
      return Response.json({ error: 'No holdings found for address', status: 404 }, { status: 404 })
    }

    await updateHoldingsProgress(activeProgressId, {
      status: 'complete',
      progress: 100,
      message: 'Historical user data ready',
      detail: `${history.dataPoints.length} chart points`
    })

    return Response.json(history, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    await updateHoldingsProgress(progressId, {
      status: 'error',
      message: 'Failed to fetch historical user data',
      detail: error instanceof Error ? error.message : String(error)
    })
    console.error('Error fetching holdings protocol return history:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return Response.json(
      { error: 'Failed to fetch holdings protocol return history', message, stack, status: 502 },
      { status: 502 }
    )
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

        if (url.pathname === '/api/holdings/progress') {
          return withCors(await handleHoldingsProgress(req))
        }

        if (url.pathname === '/api/holdings/activity') {
          return withCors(await handleHoldingsActivity(req))
        }

        if (url.pathname === '/api/holdings/activity-facets') {
          return withCors(await handleHoldingsActivityFacets(req))
        }

        if (url.pathname === '/api/holdings/breakdown') {
          return withCors(await handleHoldingsBreakdown(req))
        }

        if (
          url.pathname === '/api/holdings/protocol-return/history' ||
          url.pathname === '/api/holdings/pnl/simple-history'
        ) {
          return withCors(await handleHoldingsProtocolReturnHistory(req))
        }

        if (url.pathname === '/api/admin/invalidate-cache') {
          return withCors(await handleInvalidateCache(req))
        }

        if (url.pathname === '/api/yvusd/aprs') {
          return withCors(await handleYvUsdAprs(req))
        }

        if (url.pathname === '/api/optimization/change') {
          return withCors(await handleOptimizationChange(req))
        }

        if (url.pathname === '/api/optimization/alignment') {
          return withCors(await handleOptimizationAlignment(req))
        }

        if (url.pathname === '/api/optimization/vault-state') {
          return withCors(await handleOptimizationVaultState(req))
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
    port: API_PORT,
    idleTimeout: 120
  })

  console.log(`🚀 API server running on http://localhost:${API_PORT}`)
  console.log(`📊 Holdings API: http://localhost:${API_PORT}/api/holdings/history?address=0x...`)
  console.log(`🗂️ Holdings Activity API: http://localhost:${API_PORT}/api/holdings/activity?address=0x...`)
  console.log(`🧩 Holdings Breakdown API: http://localhost:${API_PORT}/api/holdings/breakdown?address=0x...`)
  console.log(`💹 PnL API: http://localhost:${API_PORT}/api/holdings/pnl?address=0x...`)
  console.log(`📈 Simple PnL API: http://localhost:${API_PORT}/api/holdings/pnl/simple?address=0x...`)
  console.log(`📊 Simple PnL History API: http://localhost:${API_PORT}/api/holdings/pnl/simple-history?address=0x...`)
  console.log(`🧾 PnL Drilldown API: http://localhost:${API_PORT}/api/holdings/pnl/drilldown?address=0x...`)
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
