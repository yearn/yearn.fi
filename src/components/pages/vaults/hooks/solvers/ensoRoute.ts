import { type Address, type Hex, isAddress, isAddressEqual, isHex } from 'viem'

export const ENSO_ROUTER_ADDRESSES: Record<number, Address> = {
  1: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  10: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  137: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  42161: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  8453: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  747474: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F'
}

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

export interface EnsoRouteValidationContext {
  chainId: number
  fromAddress: Address
}

export function getEnsoRouterAddress(chainId: number): Address | undefined {
  return ENSO_ROUTER_ADDRESSES[chainId]
}

function isNonNegativeBigIntString(value: string): boolean {
  try {
    return BigInt(value) >= 0n
  } catch {
    return false
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
    isAddress(candidate.tx.to, { strict: false }) &&
    typeof candidate.tx.data === 'string' &&
    isHex(candidate.tx.data, { strict: true }) &&
    typeof candidate.tx.value === 'string' &&
    isNonNegativeBigIntString(candidate.tx.value) &&
    typeof candidate.tx.from === 'string' &&
    isAddress(candidate.tx.from, { strict: false }) &&
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

export function getEnsoRouteInvariantError(
  tx: EnsoRouteResponse['tx'],
  context: EnsoRouteValidationContext
): string | undefined {
  const expectedRouter = getEnsoRouterAddress(context.chainId)

  if (
    !isAddress(context.fromAddress, { strict: false }) ||
    !isAddress(tx.to, { strict: false }) ||
    !isAddress(tx.from, { strict: false }) ||
    !isHex(tx.data, { strict: true }) ||
    !isNonNegativeBigIntString(tx.value) ||
    !Number.isInteger(tx.chainId)
  ) {
    return 'Enso route transaction fields are invalid'
  }

  if (!expectedRouter) {
    return `Enso routes are not supported on chain ${context.chainId}`
  }

  if (tx.chainId !== context.chainId) {
    return 'Enso route chain does not match the requested chain'
  }

  if (!isAddressEqual(tx.from, context.fromAddress)) {
    return 'Enso route sender does not match the connected account'
  }

  if (!isAddressEqual(tx.to, expectedRouter)) {
    return 'Enso route target does not match the expected router'
  }

  return undefined
}

export function normalizeEnsoRouteResponse(
  data: unknown,
  statusCode: number,
  context?: EnsoRouteValidationContext
): {
  error?: EnsoError
  route?: EnsoRouteResponse
} {
  if (isEnsoRouteCandidate(data)) {
    const resolvedChainId = typeof data.tx.chainId === 'number' ? data.tx.chainId : context?.chainId

    if (typeof resolvedChainId !== 'number') {
      return { error: buildEnsoError({ message: 'Enso route payload missing tx.chainId' }, statusCode) }
    }

    const route = {
      ...data,
      tx: {
        ...data.tx,
        chainId: resolvedChainId
      }
    }
    const invariantError = context ? getEnsoRouteInvariantError(route.tx, context) : undefined

    if (invariantError) {
      return { error: buildEnsoError({ message: invariantError }, statusCode) }
    }

    return {
      route
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
