import { serve } from 'bun'
import type {
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlyRevertRequest,
  TTenderlySnapshotRequest
} from '../src/components/shared/types/tenderly'
import { getVaultDecimals } from './optimization/_lib/assetLogos'
import { fetchAlignedEvents } from './optimization/_lib/envio'
import { parseExplainMetadata } from './optimization/_lib/explain-parse'
import {
  findVaultOptimization,
  isRedisAuthenticationError,
  isRedisConnectivityError,
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
const DEFAULT_API_SERVER_PORT = '3001'
const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

function resolveApiServerPort(env: NodeJS.ProcessEnv): number {
  const configuredPort = env.API_SERVER_PORT
  if (configuredPort) {
    const parsedConfiguredPort = Number(configuredPort)
    if (Number.isInteger(parsedConfiguredPort) && parsedConfiguredPort > 0) {
      return parsedConfiguredPort
    }
  }

  return Number(DEFAULT_API_SERVER_PORT)
}

const API_SERVER_PORT = resolveApiServerPort(process.env)

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
    chainId: 'all'
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

const CHANGE_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60'
const CHANGE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type'
}

async function handleOptimizationChange(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CHANGE_CORS_HEADERS })
  }

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
      const selected = findVaultOptimization(optimizations, requestedVault)
      if (!selected) {
        return Response.json({ error: `Vault not found in optimization payload: ${requestedVault}` }, { status: 404 })
      }

      return Response.json(selected, {
        headers: { ...CHANGE_CORS_HEADERS, 'Cache-Control': CHANGE_CACHE_CONTROL }
      })
    }

    return Response.json(optimizations, {
      headers: { ...CHANGE_CORS_HEADERS, 'Cache-Control': CHANGE_CACHE_CONTROL }
    })
  } catch (error) {
    if (isRedisAuthenticationError(error)) {
      return Response.json(
        {
          error:
            'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_USERNAME and UPSTASH_REDIS_REST_TOKEN credentials.'
        },
        { status: 500 }
      )
    }

    if (isRedisConnectivityError(error)) {
      return Response.json({ error: 'Backend connectivity unavailable. Unable to access Redis.' }, { status: 503 })
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

    let chainId = optimization.source.chainId
    if (!chainId) {
      const metadata = parseExplainMetadata(optimization.explain)
      chainId = metadata.chainId
    }
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
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' }
    })
  } catch (error) {
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

  const payload = body as Record<string, unknown>
  const vault = typeof payload.vault === 'string' ? payload.vault : null
  const chainId = typeof payload.chainId === 'number' ? payload.chainId : null
  const strategies = Array.isArray(payload.strategies)
    ? payload.strategies.filter((s: unknown): s is string => typeof s === 'string')
    : []

  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    return Response.json({ error: 'Invalid vault address' }, { status: 400 })
  }
  if (chainId === null || !Number.isFinite(chainId)) {
    return Response.json({ error: 'Invalid chainId' }, { status: 400 })
  }
  if (strategies.length === 0) {
    return Response.json({ error: 'No strategy addresses provided' }, { status: 400 })
  }

  try {
    const state = await fetchVaultOnChainState(chainId, vault, strategies)

    const strategyDebts: Record<string, string> = {}
    for (const [addr, debt] of state.strategyDebts) {
      strategyDebts[addr] = debt.toString()
    }

    return Response.json(
      {
        totalAssets: state.totalAssets.toString(),
        strategyDebts,
        unallocatedBps: state.unallocatedBps
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 503 })
  }
}

serve({
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === '/api/enso/status') {
      return handleEnsoStatus()
    }

    if (url.pathname === '/api/enso/balances') {
      return handleEnsoBalances(req)
    }

    if (url.pathname === '/api/enso/route') {
      return handleEnsoRoute(req)
    }

    if (url.pathname === '/api/yvusd/aprs') {
      return handleYvUsdAprs(req)
    }

    if (url.pathname === '/api/tenderly/status') {
      return handleTenderlyStatus(req)
    }

    if (url.pathname === '/api/tenderly/snapshot') {
      const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
      if (accessDeniedResponse) {
        return accessDeniedResponse
      }
      return handleTenderlySnapshot(req)
    }

    if (url.pathname === '/api/tenderly/revert') {
      const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
      if (accessDeniedResponse) {
        return accessDeniedResponse
      }
      return handleTenderlyRevert(req)
    }

    if (url.pathname === '/api/tenderly/increase-time') {
      const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
      if (accessDeniedResponse) {
        return accessDeniedResponse
      }
      return handleTenderlyIncreaseTime(req)
    }

    if (url.pathname === '/api/tenderly/fund') {
      const accessDeniedResponse = buildTenderlyAdminAccessDeniedResponse(server.requestIP(req)?.address)
      if (accessDeniedResponse) {
        return accessDeniedResponse
      }
      return handleTenderlyFund(req)
    }

    if (url.pathname === '/api/optimization/change') {
      return handleOptimizationChange(req)
    }

    if (url.pathname === '/api/optimization/alignment') {
      return handleOptimizationAlignment(req)
    }

    if (url.pathname === '/api/optimization/vault-state') {
      return handleOptimizationVaultState(req)
    }

    return new Response('Not found', { status: 404 })
  },
  port: API_SERVER_PORT
})

console.log(`🚀 API server running on http://localhost:${API_SERVER_PORT}`)
