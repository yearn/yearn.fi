import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import type { Address, Hex } from 'viem'
import { decodeAbiParameters, decodeFunctionData, isAddressEqual, isHex, parseAbi } from 'viem'

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

export interface EnsoRouteValidationContext {
  fromAddress: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  receiver: Address
  chainId: number
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

type NormalizeEnsoRouteOptions =
  | number
  | {
      fallbackChainId?: number
      validationContext?: EnsoRouteValidationContext
    }

const ensoRouterAbi = parseAbi([
  'function routeSingle((uint8 tokenType, bytes data) tokenIn, bytes data) payable returns (bytes response)',
  'function routeMulti((uint8 tokenType, bytes data)[] tokensIn, bytes data) payable returns (bytes response)',
  'function safeRouteSingle((uint8 tokenType, bytes data) tokenIn, (uint8 tokenType, bytes data) tokenOut, address receiver, bytes data) payable returns (bytes response)',
  'function safeRouteMulti((uint8 tokenType, bytes data)[] tokensIn, (uint8 tokenType, bytes data)[] tokensOut, address receiver, bytes data) payable returns (bytes response)'
])

const ensoShortcutsAbi = parseAbi([
  'function executeShortcut(bytes32 accountId, bytes32 requestId, bytes32[] commands, bytes[] state) payable returns (bytes[] response)'
])

const NATIVE_TOKEN_TYPE = 0
const ERC20_TOKEN_TYPE = 1

type TEnsoRouterToken = {
  tokenType: number
  data: Hex
}

type TDecodedFungibleToken =
  | {
      tokenType: typeof NATIVE_TOKEN_TYPE
      amount: bigint
    }
  | {
      tokenType: typeof ERC20_TOKEN_TYPE
      address: Address
      amount: bigint
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

function buildEnsoRouteValidationError(message: string): EnsoError {
  return {
    error: 'InvalidEnsoRouteTransaction',
    message,
    statusCode: 0
  }
}

function resolveNormalizeOptions(options?: NormalizeEnsoRouteOptions): {
  fallbackChainId?: number
  validationContext?: EnsoRouteValidationContext
} {
  return typeof options === 'number' ? { fallbackChainId: options } : (options ?? {})
}

function parseUnsignedInteger(value: string, label: string): bigint | EnsoError {
  if (!/^\d+$/.test(value)) {
    return buildEnsoRouteValidationError(`Enso route ${label} is not a valid unsigned integer`)
  }

  return BigInt(value)
}

function isNativeTokenAddress(address: Address): boolean {
  return isAddressEqual(address, ETH_TOKEN_ADDRESS)
}

function isSameAddress(left: Address, right: Address): boolean {
  return isAddressEqual(left, right)
}

function decodeFungibleToken(token: TEnsoRouterToken, label: string): TDecodedFungibleToken | EnsoError {
  if (!isHex(token.data)) {
    return buildEnsoRouteValidationError(`Enso route ${label} token data is not valid hex`)
  }

  try {
    if (token.tokenType === NATIVE_TOKEN_TYPE) {
      const [amount] = decodeAbiParameters([{ type: 'uint256' }], token.data)
      return { tokenType: NATIVE_TOKEN_TYPE, amount }
    }

    if (token.tokenType === ERC20_TOKEN_TYPE) {
      const [address, amount] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], token.data)
      return { tokenType: ERC20_TOKEN_TYPE, address, amount }
    }
  } catch {
    return buildEnsoRouteValidationError(`Enso route ${label} token data could not be decoded`)
  }

  return buildEnsoRouteValidationError(`Enso route ${label} token type is not supported`)
}

function validateDecodedInputToken(
  token: TEnsoRouterToken,
  context: EnsoRouteValidationContext
): EnsoError | undefined {
  const decodedToken = decodeFungibleToken(token, 'input')
  if ('error' in decodedToken) {
    return decodedToken
  }

  if (isNativeTokenAddress(context.tokenIn)) {
    if (decodedToken.tokenType !== NATIVE_TOKEN_TYPE) {
      return buildEnsoRouteValidationError('Enso route input token is not native asset')
    }
  } else {
    if (decodedToken.tokenType !== ERC20_TOKEN_TYPE || !isSameAddress(decodedToken.address, context.tokenIn)) {
      return buildEnsoRouteValidationError('Enso route input token does not match the requested token')
    }
  }

  if (decodedToken.amount !== context.amountIn) {
    return buildEnsoRouteValidationError('Enso route input amount does not match the requested amount')
  }

  return undefined
}

function validateDecodedOutputToken(
  token: TEnsoRouterToken,
  context: EnsoRouteValidationContext,
  route: EnsoRouteResponse
): EnsoError | undefined {
  const decodedToken = decodeFungibleToken(token, 'output')
  if ('error' in decodedToken) {
    return decodedToken
  }

  if (isNativeTokenAddress(context.tokenOut)) {
    if (decodedToken.tokenType !== NATIVE_TOKEN_TYPE) {
      return buildEnsoRouteValidationError('Enso route output token is not native asset')
    }
  } else {
    if (decodedToken.tokenType !== ERC20_TOKEN_TYPE || !isSameAddress(decodedToken.address, context.tokenOut)) {
      return buildEnsoRouteValidationError('Enso route output token does not match the requested token')
    }
  }

  const minAmountOut = parseUnsignedInteger(route.minAmountOut, 'minAmountOut')
  if (typeof minAmountOut !== 'bigint') {
    return minAmountOut
  }

  const amountOut = parseUnsignedInteger(route.amountOut, 'amountOut')
  if (typeof amountOut !== 'bigint') {
    return amountOut
  }

  if (amountOut < minAmountOut) {
    return buildEnsoRouteValidationError('Enso route amountOut is lower than minAmountOut')
  }

  if (decodedToken.amount !== minAmountOut) {
    return buildEnsoRouteValidationError('Enso route output min amount does not match the displayed minimum')
  }

  return undefined
}

function validateShortcutCalldata(data: Hex): EnsoError | undefined {
  if (!isHex(data) || data === '0x') {
    return buildEnsoRouteValidationError('Enso route shortcut calldata is not valid')
  }

  try {
    const decodedShortcut = decodeFunctionData({ abi: ensoShortcutsAbi, data })
    if (decodedShortcut.functionName !== 'executeShortcut') {
      return buildEnsoRouteValidationError('Enso route shortcut calldata does not call executeShortcut')
    }

    const [, , commands, state] = decodedShortcut.args
    if (commands.length === 0 || state.length === 0) {
      return buildEnsoRouteValidationError('Enso route shortcut calldata is missing route commands')
    }

    return undefined
  } catch {
    return buildEnsoRouteValidationError('Enso route shortcut calldata could not be decoded')
  }
}

export function validateEnsoRouteTransaction(
  route: EnsoRouteResponse,
  context: EnsoRouteValidationContext
): EnsoError | undefined {
  if (route.tx.chainId !== context.chainId) {
    return buildEnsoRouteValidationError('Enso route transaction chain does not match the requested chain')
  }

  if (!isSameAddress(route.tx.from, context.fromAddress)) {
    return buildEnsoRouteValidationError('Enso route transaction sender does not match the connected wallet')
  }

  if (!isHex(route.tx.data) || route.tx.data === '0x') {
    return buildEnsoRouteValidationError('Enso route transaction data is not valid router calldata')
  }

  const txValue = parseUnsignedInteger(route.tx.value || '0', 'transaction value')
  if (typeof txValue !== 'bigint') {
    return txValue
  }

  if (isNativeTokenAddress(context.tokenIn)) {
    if (txValue !== context.amountIn) {
      return buildEnsoRouteValidationError('Enso route native value does not match the requested amount')
    }
  } else if (txValue !== 0n) {
    return buildEnsoRouteValidationError('Enso route unexpectedly sends native value for an ERC-20 input')
  }

  try {
    const decodedCalldata = decodeFunctionData({ abi: ensoRouterAbi, data: route.tx.data })
    console.log({ decodedCalldata })
    if (decodedCalldata.functionName === 'routeSingle') {
      const [tokenIn, shortcutData] = decodedCalldata.args
      console.log({ tokenIn, shortcutData })
      const inputError = validateDecodedInputToken(tokenIn, context)
      if (inputError) {
        return inputError
      }

      return validateShortcutCalldata(shortcutData)
    }

    if (decodedCalldata.functionName === 'routeMulti') {
      const [tokensIn, shortcutData] = decodedCalldata.args
      if (tokensIn.length !== 1) {
        return buildEnsoRouteValidationError('Enso route multi-call does not match the single-token Yearn flow')
      }

      const inputError = validateDecodedInputToken(tokensIn[0], context)
      if (inputError) {
        return inputError
      }

      return validateShortcutCalldata(shortcutData)
    }

    if (decodedCalldata.functionName === 'safeRouteSingle') {
      const [tokenIn, tokenOut, receiver, shortcutData] = decodedCalldata.args
      const inputError = validateDecodedInputToken(tokenIn, context)
      if (inputError) {
        return inputError
      }

      const outputError = validateDecodedOutputToken(tokenOut, context, route)
      if (outputError) {
        return outputError
      }

      if (!isSameAddress(receiver, context.receiver)) {
        return buildEnsoRouteValidationError('Enso route receiver does not match the requested receiver')
      }

      return validateShortcutCalldata(shortcutData)
    }

    if (decodedCalldata.functionName === 'safeRouteMulti') {
      const [tokensIn, tokensOut, receiver, shortcutData] = decodedCalldata.args
      if (tokensIn.length !== 1 || tokensOut.length !== 1) {
        return buildEnsoRouteValidationError('Enso route multi-call does not match the single-token Yearn flow')
      }

      const inputError = validateDecodedInputToken(tokensIn[0], context)
      if (inputError) {
        return inputError
      }

      const outputError = validateDecodedOutputToken(tokensOut[0], context, route)
      if (outputError) {
        return outputError
      }

      if (!isSameAddress(receiver, context.receiver)) {
        return buildEnsoRouteValidationError('Enso route receiver does not match the requested receiver')
      }

      return validateShortcutCalldata(shortcutData)
    }

    return buildEnsoRouteValidationError('Enso route calldata does not call a supported router function')
  } catch {
    return buildEnsoRouteValidationError('Enso route transaction data could not be decoded')
  }
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
  options?: NormalizeEnsoRouteOptions
): {
  error?: EnsoError
  route?: EnsoRouteResponse
} {
  if (isEnsoRouteCandidate(data)) {
    const { fallbackChainId, validationContext } = resolveNormalizeOptions(options)
    const resolvedChainId = typeof data.tx.chainId === 'number' ? data.tx.chainId : fallbackChainId

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
    const validationError = validationContext ? validateEnsoRouteTransaction(route, validationContext) : undefined
    if (validationError) {
      return { error: validationError }
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
