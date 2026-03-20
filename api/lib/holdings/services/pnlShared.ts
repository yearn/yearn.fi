import { formatUnits } from 'viem'
import type { TLot } from './pnlTypes'

export const ZERO = 0n
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const KNOWN_VAULT_MIGRATORS = new Set([
  '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c',
  '0x1824df8d751704fa10fa371d62a37f9b8772ab90',
  '0x1112dbcf805682e828606f74ab717abf4b4fd8de'
])

export function lowerCaseAddress(address: string): string {
  return address.toLowerCase()
}

export function toVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

export function positiveBigInt(value: bigint): bigint {
  return value > ZERO ? value : ZERO
}

export function negativeBigIntMagnitude(value: bigint): bigint {
  return value < ZERO ? -value : ZERO
}

export function formatAmount(value: bigint, decimals: number): number {
  const absoluteValue = value < ZERO ? -value : value
  const sign = value < ZERO ? -1 : 1
  return sign * parseFloat(formatUnits(absoluteValue, decimals))
}

export function sumShares(lots: TLot[]): bigint {
  return lots.reduce((total, lot) => total + lot.shares, ZERO)
}

export function sumKnownCostBasis(lots: TLot[]): bigint {
  return lots.reduce((total, lot) => total + (lot.costBasis ?? ZERO), ZERO)
}
