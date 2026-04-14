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
  }
  amountOut: string
  minAmountOut: string
  gas: string
  route: EnsoRouteStep[]
}

export interface EnsoRouteStep {
  action?: string
  protocol?: string
  [key: string]: unknown
}

type EnsoRouteErrorPayload = {
  error?: string | string[]
  message?: string | string[]
  description?: string | string[]
  requestId?: string
  statusCode?: number
}

type EnsoRouteCandidate = Omit<EnsoRouteResponse, 'tx'> & {
  tx: Omit<EnsoRouteResponse['tx'], 'chainId'> & {
    chainId?: number
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

    if (typeof resolvedChainId !== 'number') {
      return { error: buildEnsoError({ message: 'Enso route payload missing tx.chainId' }, statusCode) }
    }

    return {
      route: {
        ...data,
        tx: {
          ...data.tx,
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
