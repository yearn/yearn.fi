import type { TAddress, TAddressLike } from '@shared/types'
import { getAddress, zeroAddress } from 'viem'

/******************************************************************************
 ** toAddress - Wagmi only requires a 0xString as a valid address. To use our
 ** safest version, we need to convert it between types, and the other way
 ** around.
 *****************************************************************************/
export function toAddress(address?: TAddressLike | null): TAddress {
  if (!address) {
    return zeroAddress
  }
  const trimmedAddress = address.trim()
  try {
    return getAddress(trimmedAddress)
  } catch {
    return zeroAddress
  }
}

/******************************************************************************
 ** truncateHex is used to trucate a full hex string to a specific size with
 ** a ... in the middle. Ex: 0x1234567890abcdef1234567890abcdef12345678
 ** will be truncated to 0x1234...5678
 *****************************************************************************/
export function truncateHex(address: string | undefined, size: number): string {
  if (toAddress(address) === zeroAddress) {
    if (size === 0) {
      return zeroAddress
    }
    return `0x${zeroAddress.slice(2, size)}...${zeroAddress.slice(-size)}`
  }

  if (address !== undefined) {
    if (size === 0) {
      return address
    }
    if (address.length <= size * 2 + 4) {
      return address
    }
    return `0x${address.slice(2, size + 2)}...${address.slice(-size)}`
  }
  if (size === 0) {
    return zeroAddress
  }
  return `0x${zeroAddress.slice(2, size)}...${zeroAddress.slice(-size)}`
}
