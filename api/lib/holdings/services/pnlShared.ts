import { formatUnits } from 'viem'
import type { TLot } from './pnlTypes'

export const ZERO = 0n
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const KNOWN_VAULT_ROLLOVER_INTERMEDIARIES = new Set([
  '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c',
  '0x1824df8d751704fa10fa371d62a37f9b8772ab90',
  '0x1112dbcf805682e828606f74ab717abf4b4fd8de',
  '0x4fe93ebc4ce6ae4f81601cc7ce7139023919e003'
])
export const KNOWN_ZERO_BASIS_REWARD_DISTRIBUTIONS = new Set([
  '1:0xb226c52eb411326cdb54824a88abafdaaff16d3d:0xbf319ddc2edc1eb6fdf9910e39b37be221c8805f',
  '747474:0xa03e39cdeac8c2823a6edc80956207294807c20d:0x80c34bd3a3569e126e7055831036aa7b212cb159',
  '747474:0x67c912ff560951526bffdff66dfbd4df8ae23756:0x80c34bd3a3569e126e7055831036aa7b212cb159',
  '747474:0x67c912ff560951526bffdff66dfbd4df8ae23756:0xe007ca01894c863d7898045ed5a3b4abf0b18f37',
  '747474:0x67c912ff560951526bffdff66dfbd4df8ae23756:0xaa0362ecc584b985056e47812931270b99c91f9d',
  '747474:0x67c912ff560951526bffdff66dfbd4df8ae23756:0x9a6bd7b6fd5c4f87eb66356441502fc7dcdd185b',
  '747474:0x5480f3152748809495bd56c14eab4a622aa3a19b:0x80c34bd3a3569e126e7055831036aa7b212cb159',
  '747474:0x5480f3152748809495bd56c14eab4a622aa3a19b:0xe007ca01894c863d7898045ed5a3b4abf0b18f37',
  '747474:0x5480f3152748809495bd56c14eab4a622aa3a19b:0xaa0362ecc584b985056e47812931270b99c91f9d',
  '747474:0x5480f3152748809495bd56c14eab4a622aa3a19b:0x9a6bd7b6fd5c4f87eb66356441502fc7dcdd185b'
])

export function lowerCaseAddress(address: string): string {
  return address.toLowerCase()
}

export function toVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

export function isKnownZeroBasisRewardDistribution(
  chainId: number,
  distributorAddress: string,
  rewardedTokenAddress: string
): boolean {
  return KNOWN_ZERO_BASIS_REWARD_DISTRIBUTIONS.has(
    `${chainId}:${distributorAddress.toLowerCase()}:${rewardedTokenAddress.toLowerCase()}`
  )
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
