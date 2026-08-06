import type { TToken } from '@shared/types'
import { toAddress } from '@shared/utils'

export type TSwapWalletAsset = {
  token: TToken
  isMajor: boolean
  isYearn: boolean
  isVerified: boolean
}

export function getSwapWalletAssets({
  tokens,
  knownAddresses,
  majorAddresses,
  yearnAddresses,
  excludedAddresses,
  showUnverified
}: {
  tokens: TToken[]
  knownAddresses: ReadonlySet<string>
  majorAddresses: ReadonlySet<string>
  yearnAddresses: ReadonlySet<string>
  excludedAddresses: ReadonlySet<string>
  showUnverified: boolean
}): TSwapWalletAsset[] {
  return tokens
    .filter((token) => token.balance.raw > 0n && !excludedAddresses.has(toAddress(token.address).toLowerCase()))
    .map((token): TSwapWalletAsset => {
      const address = toAddress(token.address).toLowerCase()
      const isMajor = majorAddresses.has(address)
      const isYearn = yearnAddresses.has(address)

      return {
        token,
        isMajor,
        isYearn,
        isVerified: isMajor || isYearn || knownAddresses.has(address)
      }
    })
    .filter((asset) => showUnverified || asset.isVerified)
    .sort((a, b) => {
      const rankA = a.isMajor ? 0 : a.isYearn ? 1 : a.isVerified ? 2 : 3
      const rankB = b.isMajor ? 0 : b.isYearn ? 1 : b.isVerified ? 2 : 3
      if (rankA !== rankB) return rankA - rankB
      if (a.token.value !== b.token.value) return b.token.value - a.token.value
      return a.token.symbol.localeCompare(b.token.symbol)
    })
}
