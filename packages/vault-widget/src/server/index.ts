import { isAddress } from 'viem'

const DEFAULT_ENSO_API_BASE = 'https://api.enso.build'
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store'
}

type EnsoServerOptions = {
  apiKey?: string
  apiBaseUrl?: string
  fallbackUrl?: string
}

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

async function proxyEnso(url: URL, apiKey: string | undefined, fallbackUrl?: string): Promise<Response> {
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
    if (options.policy?.allowedChainIds && !options.policy.allowedChainIds.includes(chainId)) {
      return jsonError('Unsupported source chain', 400)
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

export function createEnsoBalancesHandler(options: EnsoServerOptions) {
  return async function GET(request: Request): Promise<Response> {
    const parameters = new URL(request.url).searchParams
    const account = getRequiredAddress(parameters, 'eoaAddress')
    const chainId = Number(parameters.get('chainId') ?? '1')
    if (!account) return jsonError('Missing or invalid eoaAddress', 400)
    if (!Number.isInteger(chainId)) return jsonError('Missing or invalid chainId', 400)

    const upstream = new URL('/api/v1/wallet/balances', options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    upstream.searchParams.set('eoaAddress', account)
    upstream.searchParams.set('chainId', chainId.toString())
    return proxyEnso(upstream, options.apiKey, options.fallbackUrl)
  }
}

export function createEnsoStatusHandler(options: EnsoServerOptions) {
  return async function GET(): Promise<Response> {
    const upstream = new URL('/api/v1/status', options.apiBaseUrl ?? DEFAULT_ENSO_API_BASE)
    return proxyEnso(upstream, options.apiKey, options.fallbackUrl)
  }
}

export function createOptionsHandler(): () => Response {
  return () => new Response(null, { status: 204, headers: CORS_HEADERS })
}
