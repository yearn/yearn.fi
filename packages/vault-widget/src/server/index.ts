import { isAddress } from 'viem'
import { ENSO_ROUTER_BY_CHAIN } from '../presets/enso'

const DEFAULT_ENSO_API_BASE = 'https://api.enso.build'
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store'
}
export const ENSO_BALANCES_CACHE_CONTROL = 'private, no-store, max-age=0, must-revalidate'

type EnsoServerOptions = {
  apiKey?: string
  apiBaseUrl?: string
  fallbackUrl?: string
}

type EnsoBalancesHandlerOptions = EnsoServerOptions & {
  cacheControl?: string
  defaultChainId?: number | 'all'
  useEoa?: boolean
}

type EnsoStatusHandlerOptions = EnsoServerOptions & {
  mode?: 'configuration' | 'proxy'
}

const ENSO_BRIDGE_PROTOCOLS = ['stargate', 'ccip', 'relay'] as const
export const ENSO_SUPPORTED_CHAIN_IDS = Object.keys(ENSO_ROUTER_BY_CHAIN).map(Number)

export type EnsoRoutePolicy = {
  allowedChainIds?: readonly number[]
  isTokenPairAllowed?: (params: {
    chainId: number
    destinationChainId: number
    tokenIn: `0x${string}`
    tokenOut: `0x${string}`
  }) => boolean
  maxSlippageBps?: number
}

type EnsoRouteHandlerOptions = EnsoServerOptions & {
  policy?: EnsoRoutePolicy
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: CORS_HEADERS })
}

function getRequiredAddress(parameters: URLSearchParams, key: string): `0x${string}` | undefined {
  const value = parameters.get(key)
  return value && isAddress(value) ? value : undefined
}

function getPositiveInteger(parameters: URLSearchParams, key: string): string | undefined {
  const value = parameters.get(key)
  return value && /^\d+$/.test(value) && BigInt(value) > 0n ? value : undefined
}

async function proxyEnso(
  url: URL,
  apiKey: string | undefined,
  fallbackUrl?: string,
  responseHeaders?: HeadersInit
): Promise<Response> {
  const target = apiKey ? url : fallbackUrl ? new URL(fallbackUrl) : undefined
  if (!target) return jsonError('Enso API is not configured', 500)
  if (!apiKey) {
    url.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value)
    })
  }
  try {
    const response = await fetch(target, {
      cache: 'no-store',
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        : undefined
    })
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        ...responseHeaders,
        'Content-Type': response.headers.get('Content-Type') ?? 'application/json'
      }
    })
  } catch {
    return jsonError('Unable to reach Enso', 502)
  }
}

export function createEnsoRouteHandler(options: EnsoRouteHandlerOptions) {
  return async function GET(request: Request): Promise<Response> {
    const parameters = new URL(request.url).searchParams
    const account = getRequiredAddress(parameters, 'fromAddress')
    const receiver = getRequiredAddress(parameters, 'receiver') ?? account
    const tokenIn = getRequiredAddress(parameters, 'tokenIn')
    const tokenOut = getRequiredAddress(parameters, 'tokenOut')
    const amountIn = getPositiveInteger(parameters, 'amountIn')
    const chainId = Number(parameters.get('chainId') ?? '1')
    const destinationChainId = Number(parameters.get('destinationChainId') ?? chainId)
    const slippage = Number(parameters.get('slippage') ?? '0')
    const maxSlippage = options.policy?.maxSlippageBps ?? 500

    if (!account || !receiver) return jsonError('Missing or invalid fromAddress or receiver', 400)
    if (!tokenIn || !tokenOut) return jsonError('Missing or invalid token pair', 400)
    if (!amountIn) return jsonError('Missing or invalid amountIn', 400)
    if (!Number.isInteger(chainId) || !Number.isInteger(destinationChainId)) {
      return jsonError('Missing or invalid chain id', 400)
    }
    if (!Number.isInteger(slippage) || slippage < 0 || slippage > maxSlippage) {
      return jsonError(`Slippage must be between 0 and ${maxSlippage} basis points`, 400)
    }
    if (
      options.policy?.allowedChainIds &&
      (!options.policy.allowedChainIds.includes(chainId) ||
        !options.policy.allowedChainIds.includes(destinationChainId))
    ) {
      return jsonError('Unsupported source or destination chain', 400)
    }
    if (
      options.policy?.isTokenPairAllowed &&
      !options.policy.isTokenPairAllowed({ chainId, destinationChainId, tokenIn, tokenOut })
    ) {
      return jsonError('Unsupported token pair', 400)
    }

    const upstream = new URL('/api/v1/shortcuts/route', options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    ;[
      ['amountIn', amountIn],
      ['chainId', chainId.toString()],
      ['destinationChainId', destinationChainId.toString()],
      ['fromAddress', account],
      ['receiver', receiver],
      ['routingStrategy', parameters.get('routingStrategy') ?? 'router'],
      ['slippage', slippage.toString()],
      ['tokenIn', tokenIn],
      ['tokenOut', tokenOut]
    ].forEach(([key, value]) => {
      upstream.searchParams.set(key!, value!)
    })

    return proxyEnso(upstream, options.apiKey, options.fallbackUrl)
  }
}

export function createEnsoBalancesHandler(options: EnsoBalancesHandlerOptions) {
  return async function GET(request: Request): Promise<Response> {
    const parameters = new URL(request.url).searchParams
    const account = getRequiredAddress(parameters, 'eoaAddress')
    const chainId = parameters.get('chainId') ?? String(options.defaultChainId ?? 1)
    if (!account) return jsonError('Missing or invalid eoaAddress', 400)
    if (chainId !== 'all' && (!/^\d+$/.test(chainId) || Number(chainId) <= 0)) {
      return jsonError('Missing or invalid chainId', 400)
    }

    const upstream = new URL('/api/v1/wallet/balances', options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    upstream.searchParams.set('eoaAddress', account)
    upstream.searchParams.set('chainId', chainId)
    if (options.useEoa !== undefined) upstream.searchParams.set('useEoa', String(options.useEoa))
    return proxyEnso(
      upstream,
      options.apiKey,
      options.fallbackUrl,
      options.cacheControl ? { 'Cache-Control': options.cacheControl } : undefined
    )
  }
}

export function createEnsoStatusHandler(options: EnsoStatusHandlerOptions) {
  return async function GET(): Promise<Response> {
    if (options.mode === 'configuration') {
      return Response.json(
        { configured: Boolean(options.apiKey || options.fallbackUrl) },
        {
          headers: CORS_HEADERS
        }
      )
    }
    const upstream = new URL('/api/v1/status', options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    return proxyEnso(upstream, options.apiKey, options.fallbackUrl)
  }
}

export function createEnsoBridgeStatusHandler(options: EnsoServerOptions) {
  return async function GET(request: Request): Promise<Response> {
    const parameters = new URL(request.url).searchParams
    const protocol = parameters.get('protocol')
    const chainId = Number(parameters.get('chainId'))
    const txHash = parameters.get('txHash')

    if (!ENSO_BRIDGE_PROTOCOLS.some((candidate) => candidate === protocol)) {
      return jsonError('Missing or unsupported bridge protocol', 400)
    }
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return jsonError('Missing or invalid chainId', 400)
    }
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return jsonError('Missing or invalid txHash', 400)
    }

    const upstream = new URL(`/api/v1/${protocol}/bridge/check`, options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    upstream.searchParams.set('chainId', chainId.toString())
    upstream.searchParams.set('txHash', txHash)
    return proxyEnso(upstream, options.apiKey, options.fallbackUrl)
  }
}

export function createOptionsHandler(): () => Response {
  return () => new Response(null, { status: 204, headers: CORS_HEADERS })
}
