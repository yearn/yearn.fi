import { formatUnits } from 'viem'

export const ZERO = 0n
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
export const KNOWN_COMPATIBLE_ASSET_VAULT_ROLLOVERS = new Set([
  '1:0x23346b04a7f55b8760e5860aa5a77383d63491cd:0x9f4330700a36b29952869fac9b33f45eedd8a3d8'
])

export function lowerCaseAddress(address: string): string {
  return address.toLowerCase()
}

export function toVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

export function isKnownCompatibleAssetVaultRollover(
  chainId: number,
  outerVaultAddress: string,
  innerVaultAddress: string
): boolean {
  return KNOWN_COMPATIBLE_ASSET_VAULT_ROLLOVERS.has(
    `${chainId}:${outerVaultAddress.toLowerCase()}:${innerVaultAddress.toLowerCase()}`
  )
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

export function formatAmount(value: bigint, decimals: number): number {
  const absoluteValue = value < ZERO ? -value : value
  const sign = value < ZERO ? -1 : 1
  return sign * parseFloat(formatUnits(absoluteValue, decimals))
}
