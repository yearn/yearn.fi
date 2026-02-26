import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultVersion,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getNativeTokenWrapperContract } from '@pages/vaults/utils/nativeTokens'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'

export type TVaultWithMetadata = {
  vault: TKongVault
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
): (vault: TKongVaultInput) => boolean {
  return function checkHasHoldings(vault: TKongVaultInput): boolean {
    const address = getVaultAddress(vault)
    const chainID = getVaultChainID(vault)
    const staking = getVaultStaking(vault)

    const vaultBalance = getBalance({ address, chainID })
    const hasVaultBalance = vaultBalance.raw > 0n
    let vaultPrice: { normalized: number } | null = null

    const getVaultPrice = (): { normalized: number } => {
      if (!vaultPrice) {
        vaultPrice = getPrice({ address, chainID })
      }
      return vaultPrice
    }

    if (!isZeroAddress(staking.address)) {
      const stakingBalance = getBalance({
        address: staking.address,
        chainID
      })
      const hasValidStakedBalance = stakingBalance.raw > 0n
      if (hasValidStakedBalance) {
        const price = getVaultPrice()
        if (price.normalized <= 0) {
          return true
        }
        const stakedBalanceValue = Number(stakingBalance.normalized) * price.normalized
        if (!(shouldHideDust && stakedBalanceValue < 0.01)) {
          return true
        }
      }
    }

    if (!hasVaultBalance) {
      return false
    }

    const price = getVaultPrice()
    if (price.normalized <= 0) {
      return true
    }
    const balanceValue = Number(vaultBalance.normalized) * price.normalized

    return !(shouldHideDust && balanceValue < 0.01)
  }
}

export function createCheckHasAvailableBalance(getBalance: TBalanceGetter): (vault: TKongVaultInput) => boolean {
  return function checkHasAvailableBalance(vault: TKongVaultInput): boolean {
    const token = getVaultToken(vault)
    const chainID = getVaultChainID(vault)
    const wantBalance = getBalance({ address: token.address, chainID })
    if (wantBalance.raw > 0n) {
      return true
    }

    const nativeWrapper = getNativeTokenWrapperContract(chainID)
    if (toAddress(token.address) === toAddress(nativeWrapper)) {
      const nativeBalance = getBalance({ address: ETH_TOKEN_ADDRESS, chainID })
      if (nativeBalance.raw > 0n) {
        return true
      }
    }

    return false
  }
}

export function getVaultKey(vault: TKongVaultInput): string {
  return `${getVaultChainID(vault)}_${toAddress(getVaultAddress(vault))}`
}

export function matchesSearch(vault: TKongVaultInput, search: string): boolean {
  const token = getVaultToken(vault)
  const searchableText = `${getVaultName(vault)} ${getVaultSymbol(vault)} ${token.name} ${token.symbol} ${getVaultAddress(vault)} ${token.address}`

  try {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const searchRegex = new RegExp(escapedSearch, 'i')
    return searchRegex.test(searchableText)
  } catch {
    const lowercaseSearch = search.toLowerCase()
    return searchableText.toLowerCase().includes(lowercaseSearch)
  }
}

export function isV3Vault(vault: TKongVaultInput, isAllocatorOverride: boolean): boolean {
  const version = getVaultVersion(vault)
  return version.startsWith('3') || version.startsWith('~3') || isAllocatorOverride
}

export function extractHoldingsVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasHoldings }) => hasHoldings)
    .map(({ vault }) => vault)
}

export function extractAvailableVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasAvailableBalance }) => hasAvailableBalance)
    .map(({ vault }) => vault)
}
