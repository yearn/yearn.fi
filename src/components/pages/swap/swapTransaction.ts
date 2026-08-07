import type { Token as TRpcToken } from '@pages/vaults/hooks/useTokens'
import type { TNormalizedBN, TToken } from '@shared/types'
import { toNormalizedBN } from '@shared/utils'
import { type Address, isAddressEqual } from 'viem'

type TBalanceToken = Pick<TToken, 'address' | 'balance'>

function isMatchingToken(token: TBalanceToken | TRpcToken | undefined, address: Address): boolean {
  return Boolean(token?.address && isAddressEqual(token.address, address))
}

export function resolveSwapTokenBalance({
  address,
  walletBalanceToken,
  rpcToken,
  fallbackWalletToken,
  fallbackDecimals
}: {
  address: Address
  walletBalanceToken?: TBalanceToken
  rpcToken?: TRpcToken
  fallbackWalletToken?: TBalanceToken
  fallbackDecimals: number
}): TNormalizedBN {
  if (isMatchingToken(walletBalanceToken, address)) {
    return walletBalanceToken!.balance
  }

  if (isMatchingToken(rpcToken, address)) {
    return rpcToken!.balance
  }

  if (isMatchingToken(fallbackWalletToken, address)) {
    return fallbackWalletToken!.balance
  }

  return toNormalizedBN(0n, rpcToken?.decimals ?? fallbackDecimals)
}

export function getSwapWorstCaseImpact({
  inputUsd,
  expectedOutUsd,
  minExpectedOutUsd
}: {
  inputUsd: number
  expectedOutUsd: number
  minExpectedOutUsd: number
}): number {
  if (inputUsd <= 0 || expectedOutUsd <= 0) {
    return 0
  }

  if (minExpectedOutUsd <= 0) {
    return 100
  }

  return Math.max(0, ((inputUsd - minExpectedOutUsd) / inputUsd) * 100)
}

export function hasExecutableSwapMinimum(expectedOut: bigint, minExpectedOut: bigint): boolean {
  return expectedOut > 0n && minExpectedOut > 0n
}

export function getSwapSuccessMessage({
  formattedInput,
  fromSymbol,
  formattedExpectedOutput,
  toSymbol,
  isCrossChain
}: {
  formattedInput: string
  fromSymbol: string
  formattedExpectedOutput: string
  toSymbol: string
  isCrossChain: boolean
}): string {
  if (isCrossChain) {
    return `Your cross-chain swap to ${toSymbol} has been submitted. It may take a few minutes to arrive.`
  }

  return `Swap confirmed for ${formattedInput} ${fromSymbol}. Expected output: ${formattedExpectedOutput} ${toSymbol}.`
}
