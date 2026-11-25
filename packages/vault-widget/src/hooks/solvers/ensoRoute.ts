import { ETH_TOKEN_ADDRESS } from '@yearn/vault-widget/internal/utils/constants'
import {
  type Address,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  isAddressEqual,
  parseAbi
} from 'viem'

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
}

export interface EnsoRouteStep {
  action?: string
  protocol?: string
  [key: string]: unknown
}

export type EnsoBridgeProtocol = 'stargate' | 'ccip' | 'relay'

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

export function getEnsoBridgeProtocol(route: EnsoRouteResponse | undefined): EnsoBridgeProtocol | undefined {
  const protocol = route?.route.find((step) => step.action?.toLowerCase() === 'bridge')?.protocol?.toLowerCase()
  return protocol === 'stargate' || protocol === 'ccip' || protocol === 'relay' ? protocol : undefined
}

const ENSO_ROUTER_ABI = parseAbi([
  'struct Token { uint8 tokenType; bytes data; }',
  'function routeSingle(Token tokenIn, bytes data) payable returns (bytes)',
  'function safeRouteSingle(Token tokenIn, Token tokenOut, address receiver, bytes data) payable returns (bytes)'
])
const ENSO_NATIVE_TOKEN_TYPE = 0
const ENSO_ERC20_TOKEN_TYPE = 1

export type EnsoRouteRequest = {
  fromAddress: Address
  receiver?: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  isCrossChain: boolean
}

function encodeEnsoToken(token: Address, amount: bigint): { tokenType: number; data: Hex } {
  return isAddressEqual(token, ETH_TOKEN_ADDRESS)
    ? { tokenType: ENSO_NATIVE_TOKEN_TYPE, data: encodeAbiParameters([{ type: 'uint256' }], [amount]) }
    : {
        tokenType: ENSO_ERC20_TOKEN_TYPE,
        data: encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [token, amount])
      }
}

function decodeRouteSingle(
  route: EnsoRouteResponse
): { tokenIn: { tokenType: number; data: Hex }; data: Hex } | undefined {
  try {
    const decoded = decodeFunctionData({ abi: ENSO_ROUTER_ABI, data: route.tx.data })
    return decoded.functionName === 'routeSingle' ? { tokenIn: decoded.args[0], data: decoded.args[1] } : undefined
  } catch {
    return undefined
  }
}

function parseBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

export function bindEnsoRouteToRequest(
  route: EnsoRouteResponse,
  request: EnsoRouteRequest
): { route?: EnsoRouteResponse; error?: EnsoError } {
  const decoded = decodeRouteSingle(route)
  const expectedTokenIn = encodeEnsoToken(request.tokenIn, request.amountIn)
  const expectedValue = expectedTokenIn.tokenType === ENSO_NATIVE_TOKEN_TYPE ? request.amountIn : 0n
  const minAmountOut = parseBigInt(route.minAmountOut)

  if (
    !decoded ||
    minAmountOut === undefined ||
    route.tx.from.toLowerCase() !== request.fromAddress.toLowerCase() ||
    parseBigInt(route.tx.value) !== expectedValue ||
    decoded.tokenIn.tokenType !== expectedTokenIn.tokenType ||
    decoded.tokenIn.data.toLowerCase() !== expectedTokenIn.data.toLowerCase()
  ) {
    return {
      error: buildEnsoError(
        {
          error: 'UnexpectedEnsoRoute',
          message: 'Enso returned a transaction that does not match this request. Please retry the quote.'
        },
        0
      )
    }
  }

  if (request.isCrossChain) {
    return { route }
  }

  return {
    route: {
      ...route,
      tx: {
        ...route.tx,
        data: encodeFunctionData({
          abi: ENSO_ROUTER_ABI,
          functionName: 'safeRouteSingle',
          args: [
            decoded.tokenIn,
            encodeEnsoToken(request.tokenOut, minAmountOut),
            request.receiver ?? request.fromAddress,
            decoded.data
          ]
        })
      }
    }
  }
}
