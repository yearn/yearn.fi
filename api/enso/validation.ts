const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/
const INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/
const MAX_AMOUNT_LENGTH = 80
const MAX_OPTIONAL_VALUE_LENGTH = 64

export type TQuoteParams = {
  fromAddress: string
  chainId: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage: string
  destinationChainId?: string
  receiver?: string
  routingStrategy?: string
}

type TValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

function singleValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function isValidAddress(value: string | undefined): value is string {
  return Boolean(value && ADDRESS_PATTERN.test(value))
}

function isValidChainId(value: string | undefined): value is string {
  return Boolean(value && INTEGER_PATTERN.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value)))
}

function isPositiveDecimal(value: string | undefined): value is string {
  return Boolean(
    value &&
      value.length <= MAX_AMOUNT_LENGTH &&
      DECIMAL_PATTERN.test(value) &&
      Number(value) > 0 &&
      Number.isFinite(Number(value))
  )
}

function isValidSlippage(value: string | undefined): value is string {
  return Boolean(value && INTEGER_PATTERN.test(value) && Number(value) >= 1 && Number(value) <= 1000)
}

function isValidRoutingStrategy(value: string | undefined): value is string {
  return Boolean(value && value.length <= MAX_OPTIONAL_VALUE_LENGTH && /^[a-zA-Z0-9_-]+$/.test(value))
}

export function validateEnsoQuoteQuery(query: Record<string, unknown>): TValidationResult<TQuoteParams> {
  const fromAddress = singleValue(query.fromAddress)
  const chainId = singleValue(query.chainId)
  const tokenIn = singleValue(query.tokenIn)
  const tokenOut = singleValue(query.tokenOut)
  const amountIn = singleValue(query.amountIn)
  const slippage = singleValue(query.slippage) || '100'
  const destinationChainId = singleValue(query.destinationChainId)
  const receiver = singleValue(query.receiver)
  const routingStrategy = singleValue(query.routingStrategy)

  if (!isValidAddress(fromAddress)) {
    return { ok: false, error: 'Missing or invalid fromAddress' }
  }
  if (!isValidChainId(chainId)) {
    return { ok: false, error: 'Missing or invalid chainId' }
  }
  if (!isValidAddress(tokenIn)) {
    return { ok: false, error: 'Missing or invalid tokenIn' }
  }
  if (!isValidAddress(tokenOut)) {
    return { ok: false, error: 'Missing or invalid tokenOut' }
  }
  if (!isPositiveDecimal(amountIn)) {
    return { ok: false, error: 'Missing or invalid amountIn' }
  }
  if (!isValidSlippage(slippage)) {
    return { ok: false, error: 'Missing or invalid slippage' }
  }
  if (destinationChainId && !isValidChainId(destinationChainId)) {
    return { ok: false, error: 'Missing or invalid destinationChainId' }
  }
  if (receiver && !isValidAddress(receiver)) {
    return { ok: false, error: 'Missing or invalid receiver' }
  }
  if (routingStrategy && !isValidRoutingStrategy(routingStrategy)) {
    return { ok: false, error: 'Missing or invalid routingStrategy' }
  }

  return {
    ok: true,
    value: {
      fromAddress,
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      ...(destinationChainId ? { destinationChainId } : {}),
      ...(receiver ? { receiver } : {}),
      ...(routingStrategy ? { routingStrategy } : {})
    }
  }
}

export function validateEnsoBalancesQuery(query: Record<string, unknown>): TValidationResult<{ eoaAddress: string }> {
  const eoaAddress = singleValue(query.eoaAddress)

  if (!isValidAddress(eoaAddress)) {
    return { ok: false, error: 'Missing or invalid eoaAddress' }
  }

  return { ok: true, value: { eoaAddress } }
}
