import { isBridgeProtocol, type TSettlementRequirement } from '@yearn/vault-widget/lifecycle/settlement'
import type { Address, Hex } from 'viem'

export interface EnsoError {
  error: string
  message: string
  requestId?: string
  statusCode: number
}

export interface EnsoRouteResponse {
  tx: {
    to: Address
    data: Hex
    value: string
    from: Address
    chainId: number
    operationType?: 0 | 1
  }
  amountOut: string
  minAmountOut: string
  priceImpact?: number | null
  gas: string
  route: EnsoRouteStep[]
  bridgingEstimates?: { protocol?: string; estimatedSeconds?: number }[]
}

export interface EnsoRouteStep {
  action?: string
  protocol?: string
  [key: string]: unknown
}

export type EnsoBridgeProtocol = string

type EnsoRouteErrorPayload = {
  error?: string | string[]
  message?: string | string[]
  description?: string | string[]
  requestId?: string
  statusCode?: number
}

type EnsoRouteCandidate = Omit<EnsoRouteResponse, 'tx' | 'priceImpact'> & {
  priceImpact?: unknown
  tx: Omit<EnsoRouteResponse['tx'], 'chainId' | 'operationType'> & {
    chainId?: number
    operationType?: unknown
  }
}

function isEnsoRouteCandidate(data: unknown): data is EnsoRouteCandidate {
  if (!data || typeof data !== 'object') {
    return false
  }

  const candidate = data as Partial<EnsoRouteCandidate>
  if (!candidate.tx || typeof candidate.tx !== 'object') {
    return false
  }

  return (
    typeof candidate.tx.to === 'string' &&
    typeof candidate.tx.data === 'string' &&
    typeof candidate.tx.value === 'string' &&
    typeof candidate.tx.from === 'string' &&
    typeof candidate.amountOut === 'string' &&
    typeof candidate.minAmountOut === 'string' &&
    typeof candidate.gas === 'string' &&
    Array.isArray(candidate.route)
  )
}

function normalizeEnsoErrorText(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return value
}

function buildEnsoError(data: unknown, statusCode: number): EnsoError {
  const payload = (data && typeof data === 'object' ? data : {}) as EnsoRouteErrorPayload
  const error = normalizeEnsoErrorText(payload.error)
  const message = normalizeEnsoErrorText(payload.message)
  const description = normalizeEnsoErrorText(payload.description)

  return {
    error: error || message || 'EnsoRouteError',
    message: description || message || error || 'Unable to find route',
    requestId: payload.requestId,
    statusCode: payload.statusCode || statusCode
  }
}

function normalizeEnsoPriceImpact(value: unknown): number | null | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (value === null) {
    return null
  }

  return undefined
}

export function normalizeEnsoRouteResponse(
  data: unknown,
  statusCode: number,
  fallbackChainId?: number
): {
  error?: EnsoError
  route?: EnsoRouteResponse
} {
  if (isEnsoRouteCandidate(data)) {
    const resolvedChainId = typeof data.tx.chainId === 'number' ? data.tx.chainId : fallbackChainId
    const priceImpact = normalizeEnsoPriceImpact(data.priceImpact)
    const { priceImpact: _rawPriceImpact, tx, ...routeData } = data
    const { operationType, ...transaction } = tx

    if (operationType !== undefined && operationType !== 0) {
      return {
        error: buildEnsoError(
          {
            error: 'UnsupportedEnsoDelegateRoute',
            message: 'Enso returned an unsupported wallet route. Please retry the quote.'
          },
          statusCode
        )
      }
    }

    if (typeof resolvedChainId !== 'number') {
      return { error: buildEnsoError({ message: 'Enso route payload missing tx.chainId' }, statusCode) }
    }

    return {
      route: {
        ...routeData,
        ...(priceImpact !== undefined ? { priceImpact } : {}),
        tx: {
          ...transaction,
          ...(operationType === 0 ? { operationType: 0 as const } : {}),
          chainId: resolvedChainId
        }
      }
    }
  }

  return { error: buildEnsoError(data, statusCode) }
}

export function routeHasSwapStep(route: EnsoRouteResponse | undefined): boolean {
  if (!route) {
    return false
  }

  return route.route.some((step) => typeof step.action === 'string' && step.action.toLowerCase().includes('swap'))
}

const protocolName = (value: unknown): string | undefined =>
  typeof value === 'string' && isBridgeProtocol(value.toLowerCase()) ? value.toLowerCase() : undefined
const bridgeHops = (route: EnsoRouteResponse | undefined) =>
  route?.route.filter((step) => typeof step?.action === 'string' && step.action.toLowerCase() === 'bridge') ?? []
export function getEnsoBridgeProtocol(route: EnsoRouteResponse | undefined): EnsoBridgeProtocol | undefined {
  return protocolName(bridgeHops(route)[0]?.protocol)
}

/** Snapshot available route metadata without using response positions as persistent leg identities. */
export function getEnsoSettlement(
  route: EnsoRouteResponse | undefined,
  destinationChainId: number
): TSettlementRequirement {
  const hops = bridgeHops(route)
  const hints = Array.isArray(route?.bridgingEstimates) ? route.bridgingEstimates : []
  const protocols = [
    ...new Set(
      [...hops.map((step) => protocolName(step.protocol)), ...hints.map((item) => protocolName(item?.protocol))].filter(
        isBridgeProtocol
      )
    )
  ].slice(0, 16)
  const identified = hops.flatMap((step) =>
    typeof step.id === 'string' && step.id.length > 0 && step.id.length <= 128 && protocolName(step.protocol)
      ? [
          {
            id: step.id,
            protocol: protocolName(step.protocol)!,
            sourceChainId:
              typeof step.chainId === 'number' && Number.isSafeInteger(step.chainId) && step.chainId > 0
                ? step.chainId
                : undefined,
            destinationChainId:
              typeof step.destinationChainId === 'number' &&
              Number.isSafeInteger(step.destinationChainId) &&
              step.destinationChainId > 0
                ? step.destinationChainId
                : undefined
          }
        ]
      : []
  )
  const legs = identified
    .filter((leg, index) => identified.findIndex((other) => other.id === leg.id) === index)
    .slice(0, 32)
  const estimates = hints
    .map((item) => item?.estimatedSeconds)
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 604800
    )
  return {
    provider: 'enso',
    destinationChainId,
    protocols,
    bridgeCount: hops.length || undefined,
    coverage: hops.length > 0 && hops.length === legs.length ? 'complete' : 'incomplete',
    legs,
    estimatedSeconds: estimates.length ? Math.max(...estimates) : undefined
  }
}
