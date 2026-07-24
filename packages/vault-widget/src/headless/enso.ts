import { type Address, isAddress, isAddressEqual, isHex } from 'viem'
import type { EnsoBridgeDetails, EnsoBridgeProtocol, EnsoQuoteProvider, EnsoRoute, EnsoRouteRequest } from '../types'
import { getRemainingEnsoSlippageBps } from './settings'

type HttpEnsoQuoteProviderOptions = {
  endpoint?: string
  fetcher?: typeof fetch
  maxPriceImpactPercent?: number
  trustedRouters: Readonly<Record<number, readonly Address[]>>
  priceImpactDivisor?: number
  requirePriceImpact?: boolean
}

type EnsoRoutePayload = {
  amountOut?: unknown
  bridgingEstimates?: unknown
  minAmountOut?: unknown
  priceImpact?: unknown
  route?: unknown
  tx?: {
    chainId?: unknown
    data?: unknown
    from?: unknown
    to?: unknown
    value?: unknown
  }
}

function isUnsignedInteger(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}

function normalizePriceImpact(value: unknown, divisor: number): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, value / divisor)
}

function routeHasSwap(route: unknown): boolean {
  if (!Array.isArray(route)) return false
  return route.some(
    (step) =>
      !!step &&
      typeof step === 'object' &&
      'action' in step &&
      typeof step.action === 'string' &&
      step.action.toLowerCase().includes('swap')
  )
}

function getBridgeDetails(route: EnsoRoutePayload, request: EnsoRouteRequest): EnsoBridgeDetails | undefined {
  if (request.chainId === request.destinationChainId) return undefined
  if (!Array.isArray(route.route)) throw new Error('Cross-chain Enso route is missing bridge details')
  const bridgeStep = route.route.find(
    (step) =>
      !!step &&
      typeof step === 'object' &&
      'action' in step &&
      typeof step.action === 'string' &&
      step.action.toLowerCase() === 'bridge'
  )
  const rawProtocol =
    bridgeStep && typeof bridgeStep === 'object' && 'protocol' in bridgeStep ? bridgeStep.protocol : undefined
  const protocol = typeof rawProtocol === 'string' ? rawProtocol.toLowerCase() : undefined
  if (protocol !== 'stargate' && protocol !== 'ccip' && protocol !== 'relay') {
    throw new Error('Cross-chain Enso route uses an unsupported bridge protocol')
  }

  const estimate = Array.isArray(route.bridgingEstimates)
    ? route.bridgingEstimates.find(
        (candidate) =>
          !!candidate &&
          typeof candidate === 'object' &&
          'protocol' in candidate &&
          typeof candidate.protocol === 'string' &&
          candidate.protocol.toLowerCase() === protocol
      )
    : undefined
  const estimatedSeconds =
    estimate &&
    typeof estimate === 'object' &&
    'estimatedSeconds' in estimate &&
    typeof estimate.estimatedSeconds === 'number' &&
    Number.isFinite(estimate.estimatedSeconds) &&
    estimate.estimatedSeconds >= 0
      ? estimate.estimatedSeconds
      : undefined

  return {
    destinationChainId: request.destinationChainId,
    estimatedSeconds,
    protocol: protocol as EnsoBridgeProtocol,
    sourceChainId: request.chainId
  }
}

export function normalizeEnsoRoute(
  payload: unknown,
  request: EnsoRouteRequest,
  trustedRouters: Readonly<Record<number, readonly Address[]>>,
  priceImpactDivisor = 100
): EnsoRoute {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Enso returned an invalid route payload')
  }

  const route = payload as EnsoRoutePayload
  const transaction = route.tx
  if (!transaction) throw new Error('Enso route is missing transaction data')
  if (!isUnsignedInteger(route.amountOut) || !isUnsignedInteger(route.minAmountOut)) {
    throw new Error('Enso route has invalid output amounts')
  }
  if (
    BigInt(route.amountOut) <= 0n ||
    BigInt(route.minAmountOut) <= 0n ||
    BigInt(route.minAmountOut) > BigInt(route.amountOut)
  ) {
    throw new Error('Enso route has inconsistent output amounts')
  }
  if (typeof transaction.to !== 'string' || !isAddress(transaction.to)) {
    throw new Error('Enso route has an invalid router address')
  }
  if (typeof transaction.from !== 'string' || !isAddress(transaction.from)) {
    throw new Error('Enso route has an invalid sender')
  }
  if (!isAddressEqual(transaction.from, request.account)) {
    throw new Error('Enso route sender does not match the connected account')
  }
  if (typeof transaction.data !== 'string' || !isHex(transaction.data)) {
    throw new Error('Enso route has invalid calldata')
  }
  if (!isUnsignedInteger(transaction.value)) {
    throw new Error('Enso route has an invalid transaction value')
  }

  const executionChainId =
    typeof transaction.chainId === 'number' && Number.isInteger(transaction.chainId)
      ? transaction.chainId
      : request.chainId
  if (executionChainId !== request.chainId) {
    throw new Error('Enso route execution chain does not match the requested source chain')
  }

  const allowedRouters = trustedRouters[executionChainId] ?? []
  if (!allowedRouters.some((router) => isAddressEqual(router, transaction.to as Address))) {
    throw new Error('Enso returned an unrecognized router')
  }
  const bridge = getBridgeDetails(route, request)

  return {
    amountOut: BigInt(route.amountOut),
    minAmountOut: BigInt(route.minAmountOut),
    priceImpactPercent: normalizePriceImpact(route.priceImpact, priceImpactDivisor),
    routeHasSwap: routeHasSwap(route.route),
    ...(bridge ? { bridge } : {}),
    transaction: {
      chainId: executionChainId,
      data: transaction.data,
      from: transaction.from,
      to: transaction.to,
      value: BigInt(transaction.value)
    }
  }
}

function getErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Unable to find an Enso route'
  const record = payload as { description?: unknown; error?: unknown; message?: unknown }
  const candidate = record.description ?? record.message ?? record.error
  if (Array.isArray(candidate)) return candidate.map(String).join(', ')
  return typeof candidate === 'string' ? candidate : 'Unable to find an Enso route'
}

export function createHttpEnsoQuoteProvider(options: HttpEnsoQuoteProviderOptions): EnsoQuoteProvider {
  const endpoint = options.endpoint ?? '/api/enso/route'
  const fetcher = options.fetcher ?? fetch

  return {
    async getRoute(request): Promise<EnsoRoute> {
      async function fetchRoute(slippageBps: number): Promise<EnsoRoute> {
        const parameters = new URLSearchParams({
          amountIn: request.amountIn.toString(),
          chainId: request.chainId.toString(),
          destinationChainId: request.destinationChainId.toString(),
          fromAddress: request.account,
          receiver: request.receiver,
          routingStrategy: 'router',
          slippage: slippageBps.toString(),
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut
        })
        const response = await fetcher(`${endpoint}?${parameters}`, {
          cache: 'no-store',
          signal: request.signal
        })
        const payload: unknown = await response.json()
        if (!response.ok) throw new Error(getErrorMessage(payload))
        return normalizeEnsoRoute(payload, request, options.trustedRouters, options.priceImpactDivisor)
      }

      function validatePriceImpact(route: EnsoRoute): void {
        if (options.requirePriceImpact && route.priceImpactPercent === undefined) {
          throw new Error('Enso did not return a verifiable price impact')
        }
        if (
          route.priceImpactPercent !== null &&
          route.priceImpactPercent !== undefined &&
          route.priceImpactPercent > (options.maxPriceImpactPercent ?? 5)
        ) {
          throw new Error(
            `Enso route price impact exceeds the ${(options.maxPriceImpactPercent ?? 5).toFixed(2)}% limit`
          )
        }
      }

      const bootstrapRoute = await fetchRoute(0)
      validatePriceImpact(bootstrapRoute)
      const routeImpact = bootstrapRoute.priceImpactPercent
      const protectedSlippageBps =
        routeImpact !== null && routeImpact !== undefined && routeImpact > 0
          ? getRemainingEnsoSlippageBps({
              quoteImpactPercent: routeImpact,
              userToleranceBps: request.slippageBps
            })
          : request.slippageBps
      if (protectedSlippageBps === 0 && routeImpact && routeImpact > 0) {
        throw new Error(
          `Enso route price impact exceeds the ${(request.slippageBps / 100).toFixed(2)}% transaction tolerance`
        )
      }
      const route = protectedSlippageBps > 0 ? await fetchRoute(protectedSlippageBps) : bootstrapRoute
      validatePriceImpact(route)
      return { ...route, expiresAt: Date.now() + 15_000 }
    }
  }
}
