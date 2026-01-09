import type { TAddress } from '@lib/types/address'
import type { TNormalizedBN } from '@lib/types/mixed'
import { toAddress } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNativeTokenWrapperContract } from '@vaults/utils/nativeTokens'

export type TVaultWithMetadata = {
  vault: TYDaemonVault
  hasHoldings: boolean
  hasAvailableBalance: boolean
  isHoldingsVault: boolean
  isMigratableVault: boolean
  isRetiredVault: boolean
}

export type TVaultFlags = {
  hasHoldings: boolean
  isMigratable: boolean
  isRetired: boolean
  isHidden: boolean
}

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceGetter = (params: TTokenAndChain) => TNormalizedBN
type TPriceGetter = (params: TTokenAndChain) => { normalized: number }

export function createCheckHasHoldings(
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter,
  shouldHideDust: boolean
): (vault: TYDaemonVault) => boolean {
  return function checkHasHoldings(vault: TYDaemonVault): boolean {
    const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
    const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

    if (vault.staking.available) {
      const stakingBalance = getBalance({
        address: vault.staking.address,
        chainID: vault.chainID
      })
      const hasValidStakedBalance = stakingBalance.raw > 0n
      const stakedBalanceValue = Number(stakingBalance.normalized) * vaultPrice.normalized
      if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
        return true
      }
    }

    const hasValidBalance = vaultBalance.raw > 0n
    const balanceValue = Number(vaultBalance.normalized) * vaultPrice.normalized

    return hasValidBalance && !(shouldHideDust && balanceValue < 0.01)
  }
}

export function createCheckHasAvailableBalance(getBalance: TBalanceGetter): (vault: TYDaemonVault) => boolean {
  return function checkHasAvailableBalance(vault: TYDaemonVault): boolean {
    const wantBalance = getBalance({ address: vault.token.address, chainID: vault.chainID })
    if (wantBalance.raw > 0n) {
      return true
    }

    const nativeWrapper = getNativeTokenWrapperContract(vault.chainID)
    if (toAddress(vault.token.address) === toAddress(nativeWrapper)) {
      const nativeBalance = getBalance({ address: ETH_TOKEN_ADDRESS, chainID: vault.chainID })
      if (nativeBalance.raw > 0n) {
        return true
      }
    }

    return false
  }
}

export function getVaultKey(vault: TYDaemonVault): string {
  return `${vault.chainID}_${toAddress(vault.address)}`
}

export function matchesSearch(vault: TYDaemonVault, search: string): boolean {
  const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

  try {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const searchRegex = new RegExp(escapedSearch, 'i')
    return searchRegex.test(searchableText)
  } catch {
    const lowercaseSearch = search.toLowerCase()
    return searchableText.toLowerCase().includes(lowercaseSearch)
  }
}

export function isV3Vault(vault: TYDaemonVault, isAllocatorOverride: boolean): boolean {
  return vault.version?.startsWith('3') || vault.version?.startsWith('~3') || isAllocatorOverride
}

export function extractHoldingsVaults(vaultMap: Map<string, TVaultWithMetadata>): TYDaemonVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasHoldings }) => hasHoldings)
    .map(({ vault }) => vault)
}

export function extractAvailableVaults(vaultMap: Map<string, TVaultWithMetadata>): TYDaemonVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasAvailableBalance }) => hasAvailableBalance)
    .map(({ vault }) => vault)
}
