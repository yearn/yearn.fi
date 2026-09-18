import type { TAddress } from '@shared/types/address'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { isZeroAddress, toAddress } from '@shared/utils/tools.address'

export { isZeroAddress }

export function isZero(value?: bigint | number | string | null): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    value = value.trim().replace(',', '.')

    if (value === '') {
      return false
    }

    // Check if the string can be parsed as a floating-point number
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed === 0
    }
  }

  try {
    return BigInt(value) === 0n
  } catch {
    return false
  }
}

/******************************************************************************
 * isAddress - Checks if a string is a valid Ethereum address.
 *****************************************************************************/
export function isAddress(address?: string | null): address is TAddress {
  const regex = /^0x([0-9a-f][0-9a-f])*$/i
  return !!address && regex.test(address) && !isZeroAddress(address)
}

/******************************************************************************
 * isTAddress - Checks if a string is a valid TAddress type.
 *****************************************************************************/
export function isTAddress(address?: string | null): address is TAddress {
  const regex = /^0x([0-9a-f][0-9a-f])*$/i
  return !!address && regex.test(address)
}

/******************************************************************************
 * isTAddress - Checks if the address is the ETH address
 *****************************************************************************/
export function isEthAddress(address?: string | null | TAddress): boolean {
  return toAddress(address) === toAddress(ETH_TOKEN_ADDRESS)
}
