import type { TAddress, TAddressLike } from '@yearn/vault-widget/types'
import { getAddress, zeroAddress } from 'viem'

type ClassValue = string | null | undefined | false | Record<string, boolean | null | undefined>

export function cl(...classes: ClassValue[]): string {
  return classes
    .flatMap((entry) => {
      if (!entry) {
        return []
      }
      if (typeof entry === 'string') {
        return [entry]
      }
      return Object.entries(entry).flatMap(([className, shouldInclude]) => (shouldInclude ? [className] : []))
    })
    .join(' ')
}

export function toAddress(address?: TAddressLike | null): TAddress {
  if (!address) {
    return zeroAddress
  }

  try {
    return getAddress(address.trim())
  } catch {
    return zeroAddress
  }
}

export function isZeroAddress(address?: string | null): boolean {
  return toAddress(address) === zeroAddress
}

export function isSafeConnectorId(connectorId?: string): boolean {
  return connectorId?.toLowerCase() === 'safe'
}

export * from '@yearn/vault-widget/internal/utils/approve'
export * from '@yearn/vault-widget/internal/utils/constants'
export * from '@yearn/vault-widget/internal/utils/format'
export * from '@yearn/vault-widget/internal/utils/slippage'
