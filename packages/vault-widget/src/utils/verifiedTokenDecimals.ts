export const NATIVE_TOKEN_DECIMALS = 18
export const TOKEN_DECIMALS_MISMATCH_MESSAGE = 'Token decimals do not match on-chain value'
export const TOKEN_DECIMALS_UNAVAILABLE_MESSAGE = 'Unable to verify token decimals'

export type TVerifiedTokenDecimals = {
  decimals?: number
  error?: string
}

/*******************************************************************************
 ** Off-chain token metadata (token lists, Kong, Enso balances) must agree with
 ** the token contract before its decimals are used to build a transaction.
 ** No verified decimals means no transaction: callers must not fall back to 18.
 ******************************************************************************/
export function getVerifiedTokenDecimals({
  listedDecimals,
  onChainDecimals,
  isNativeToken,
  isLoading,
  isError
}: {
  listedDecimals?: number
  onChainDecimals?: number
  isNativeToken: boolean
  isLoading: boolean
  isError: boolean
}): TVerifiedTokenDecimals {
  if (listedDecimals === undefined) {
    return { error: TOKEN_DECIMALS_UNAVAILABLE_MESSAGE }
  }
  const expectedDecimals = isNativeToken ? NATIVE_TOKEN_DECIMALS : onChainDecimals
  if (!isNativeToken && isLoading) {
    return {}
  }
  if (expectedDecimals === undefined || isError) {
    return { error: TOKEN_DECIMALS_UNAVAILABLE_MESSAGE }
  }
  if (expectedDecimals !== listedDecimals) {
    return { error: TOKEN_DECIMALS_MISMATCH_MESSAGE }
  }
  return { decimals: expectedDecimals }
}
