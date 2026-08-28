import { formatUnits } from 'viem'

export const ZERO = 0n
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
