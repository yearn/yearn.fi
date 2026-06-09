import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

export const YVBTC_CHAIN_ID = 1
export const YVBTC_UNLOCKED_ADDRESS = toAddress('0xb8787E236e699654F910CAD14F338d0DdB529Fd7') as Address
export const YVBTC_LOCKED_ADDRESS = toAddress('0x0000000000000000000000000000000000000000') as Address
export const YVBTC_DESCRIPTION =
  'BTC-denominated vault. A locked yvBTC variant is planned, but the locked contract address is a temporary placeholder until launch.'

export function isYvBtcAddress(address?: string | null): boolean {
  if (!address) {
    return false
  }

  return toAddress(address) === YVBTC_UNLOCKED_ADDRESS
}

export function isYvBtcVault(vault?: TKongVaultInput | null): boolean {
  if (!vault) {
    return false
  }

  return isYvBtcAddress(vault.address)
}
