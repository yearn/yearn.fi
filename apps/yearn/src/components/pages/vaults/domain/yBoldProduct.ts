import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@yearn/vault-widget/ybold'
import type { Address } from 'viem'

export { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS }

const YBOLD_VAULT_ADDRESS_LOWERCASE = YBOLD_VAULT_ADDRESS.toLowerCase()
const YBOLD_PRODUCT_ADDRESSES = new Set([YBOLD_VAULT_ADDRESS_LOWERCASE, YBOLD_STAKING_ADDRESS.toLowerCase()])

export function isYBoldVaultAddress(address: Address | string | undefined): boolean {
  return address?.toLowerCase() === YBOLD_VAULT_ADDRESS_LOWERCASE
}

export function isYBoldProductAddress(address: Address | string | undefined): boolean {
  return Boolean(address && YBOLD_PRODUCT_ADDRESSES.has(address.toLowerCase()))
}
