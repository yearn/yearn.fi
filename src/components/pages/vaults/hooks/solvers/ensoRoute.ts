import type { Abi, Address, Hex } from 'viem'
import { decodeAbiParameters, decodeFunctionData, isAddressEqual } from 'viem'

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

export function isCanonicalEnsoIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)
}

export function parseEnsoRouteBigInt(value: unknown): bigint | undefined {
  return isCanonicalEnsoIntegerString(value) ? BigInt(value) : undefined
}

export interface EnsoRouteInvariantContext {
  chainId: number
  fromAddress: Address
  tokenIn: Address
  tokenOut: Address
  receiver: Address
  expectedOut: bigint | string
  minExpectedOut: bigint | string
}

const ENSO_ROUTER_ABI = [
  {
    type: 'function',
    name: 'safeRouteSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'tokenIn',
        type: 'tuple',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'tokenOut',
        type: 'tuple',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      { name: 'receiver', type: 'address' },
      { name: 'data', type: 'bytes' }
    ],
    outputs: [{ name: 'response', type: 'bytes' }]
  },
  {
    type: 'function',
    name: 'safeRouteMulti',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'tokensIn',
        type: 'tuple[]',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'tokensOut',
        type: 'tuple[]',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      { name: 'receiver', type: 'address' },
      { name: 'data', type: 'bytes' }
    ],
    outputs: [{ name: 'response', type: 'bytes' }]
  }
] as const satisfies Abi

type EnsoToken = {
  tokenType: number
  data: Hex
}

type DecodedEnsoRouteCalldata = {
  receiver: Address
  tokenOut: Address
  minExpectedOut: bigint
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
    isCanonicalEnsoIntegerString(candidate.amountOut) &&
    isCanonicalEnsoIntegerString(candidate.minAmountOut) &&
    isCanonicalEnsoIntegerString(candidate.gas) &&
    Array.isArray(candidate.route)
  )
}

function normalizeEnsoErrorText(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return value
}

function resolveEnsoErrorStatusCode(payloadStatusCode: number | undefined, responseStatusCode: number): number {
  if (
    typeof payloadStatusCode === 'number' &&
    Number.isInteger(payloadStatusCode) &&
    payloadStatusCode >= 400 &&
    payloadStatusCode <= 599
  ) {
    return payloadStatusCode
  }

  if (Number.isInteger(responseStatusCode) && responseStatusCode >= 400 && responseStatusCode <= 599) {
    return responseStatusCode
  }

  return 502
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
    statusCode: resolveEnsoErrorStatusCode(payload.statusCode, statusCode)
  }
}

function normalizeRawAmount(value: bigint | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value)
}

function decodeEnsoTokenAmount(token: EnsoToken): { token: Address; amount: bigint } | undefined {
  try {
    const [tokenAddress, amount] = decodeAbiParameters(
      [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      token.data
    )

    return { token: tokenAddress, amount }
  } catch {
    return undefined
  }
}

function decodeEnsoRouteCalldata(data: Hex): DecodedEnsoRouteCalldata | undefined {
  try {
    const decoded = decodeFunctionData({
      abi: ENSO_ROUTER_ABI,
      data
    })

    if (decoded.functionName === 'safeRouteSingle') {
      const [, tokenOut, receiver] = decoded.args
      const decodedTokenOut = decodeEnsoTokenAmount(tokenOut)

      return decodedTokenOut
        ? { receiver, tokenOut: decodedTokenOut.token, minExpectedOut: decodedTokenOut.amount }
        : undefined
    }

    if (decoded.functionName === 'safeRouteMulti') {
      const [, tokensOut, receiver] = decoded.args
      if (tokensOut.length !== 1) {
        return undefined
      }

      const decodedTokenOut = decodeEnsoTokenAmount(tokensOut[0])

      return decodedTokenOut
        ? { receiver, tokenOut: decodedTokenOut.token, minExpectedOut: decodedTokenOut.amount }
        : undefined
    }

    return undefined
  } catch {
    return undefined
  }
}

export function getEnsoRouteInvariantError(
  tx: EnsoRouteResponse['tx'],
  context: EnsoRouteInvariantContext
): string | undefined {
  if (tx.chainId !== context.chainId) return 'Enso route chain does not match the requested chain'
  if (!isAddressEqual(tx.from, context.fromAddress)) return 'Enso route sender does not match the connected account'

  const decoded = decodeEnsoRouteCalldata(tx.data)
  if (!decoded) return 'Enso route calldata could not be verified'
  if (!isAddressEqual(decoded.receiver, context.receiver))
    return 'Enso route receiver does not match the connected account'
  if (!isAddressEqual(decoded.tokenOut, context.tokenOut))
    return 'Enso route output token does not match the requested vault'
  if (decoded.minExpectedOut !== normalizeRawAmount(context.minExpectedOut)) {
    return 'Enso route minimum output does not match the displayed minimum'
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
