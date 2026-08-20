import type { Address } from 'viem'

export const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
export const YBOLD_STAKING_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

const YBOLD_VAULT_ADDRESS_LOWERCASE = YBOLD_VAULT_ADDRESS.toLowerCase()
const YBOLD_PRODUCT_ADDRESSES = new Set([YBOLD_VAULT_ADDRESS_LOWERCASE, YBOLD_STAKING_ADDRESS.toLowerCase()])

export function isYBoldVaultAddress(address: Address | string | undefined): boolean {
  return address?.toLowerCase() === YBOLD_VAULT_ADDRESS_LOWERCASE
}

export function isYBoldProductAddress(address: Address | string | undefined): boolean {
  return Boolean(address && YBOLD_PRODUCT_ADDRESSES.has(address.toLowerCase()))
}
