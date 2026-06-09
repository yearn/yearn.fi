import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { toAddress } from '@shared/utils'

function getChainAddressKey(chainID: number | undefined, address: string): string {
  return `${chainID}_${toAddress(address)}`
}

export function hasYvUsdPortfolioHoldings(holdingsKeySet: Set<string>): boolean {
  return [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS].some((address) =>
    holdingsKeySet.has(getChainAddressKey(YVUSD_CHAIN_ID, address))
  )
}
