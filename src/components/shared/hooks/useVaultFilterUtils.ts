import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  getVaultVersion,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getNativeTokenWrapperContract } from '@pages/vaults/utils/nativeTokens'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'

export type TVaultWithMetadata = {
  vault: TKongVaultInput
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
type TTokenGetter = (params: TTokenAndChain) => { value?: number }

export function createCheckHasHoldings(
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter,
  shouldHideDust: boolean
): (vault: TKongVaultInput) => boolean {
  return function checkHasHoldings(vault: TKongVaultInput): boolean {
    const vaultAddress = getVaultAddress(vault)
    const chainID = getVaultChainID(vault)
    const staking = getVaultStaking(vault)
    const vaultBalance = getBalance({ address: vaultAddress, chainID })
    const hasVaultBalance = vaultBalance.raw > 0n
    const vaultPrice = getPrice({ address: vaultAddress, chainID })

    if (staking.available && !isZeroAddress(staking.address)) {
      const stakingBalance = getBalance({
        address: staking.address,
        chainID
      })
      const hasValidStakedBalance = stakingBalance.raw > 0n
      if (hasValidStakedBalance) {
        const stakedBalanceValue = Number(stakingBalance.normalized) * vaultPrice.normalized
        if (!(shouldHideDust && stakedBalanceValue < 0.01)) {
          return true
        }
      }
    }

    if (!hasVaultBalance) {
      return false
    }

    const balanceValue = Number(vaultBalance.normalized) * vaultPrice.normalized

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

export function getVaultHoldingsUsdValue(
  vault: TKongVaultInput,
  getToken: TTokenGetter,
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter
): number {
  const vaultAddress = getVaultAddress(vault)
  const chainID = getVaultChainID(vault)
  const staking = getVaultStaking(vault)
  const token = getVaultToken(vault)
  const vaultToken = getToken({ address: vaultAddress, chainID })
  const vaultDirectValue = Number(vaultToken.value || 0)
  const vaultShares = Number(getBalance({ address: vaultAddress, chainID }).normalized || 0)

  const canUseStaking = staking.available && !isZeroAddress(staking.address)
  const stakingToken = canUseStaking ? getToken({ address: staking.address, chainID }) : null
  const stakingDirectValue = Number(stakingToken?.value || 0)
  const stakingShares = canUseStaking ? Number(getBalance({ address: staking.address, chainID }).normalized || 0) : 0

  const vaultSharePrice = Number(getPrice({ address: vaultAddress, chainID }).normalized || 0)
  const pricePerShare = (() => {
    if ('apr' in vault) {
      return Number(vault.apr?.pricePerShare?.today || 0)
    }
    if ('pricePerShare' in vault) {
      return Number(toNormalizedBN(vault.pricePerShare ?? 0, token.decimals).normalized || 0)
    }
    return 0
  })()
  const resolvedAssetPrice = Number(getPrice({ address: token.address, chainID }).normalized || 0)
  const assetPrice = resolvedAssetPrice > 0 ? resolvedAssetPrice : Number(getVaultTVL(vault)?.price || 0)

  const resolvePositionValue = (directValue: number, shares: number): number => {
    if (Number.isFinite(directValue) && directValue > 0) {
      return directValue
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      return 0
    }
    if (Number.isFinite(vaultSharePrice) && vaultSharePrice > 0) {
      const viaVaultPrice = shares * vaultSharePrice
      if (Number.isFinite(viaVaultPrice)) {
        return viaVaultPrice
      }
    }
    if (Number.isFinite(pricePerShare) && pricePerShare > 0 && Number.isFinite(assetPrice) && assetPrice > 0) {
      const viaPps = shares * pricePerShare * assetPrice
      if (Number.isFinite(viaPps)) {
        return viaPps
      }
    }
    return 0
  }

  const totalValue =
    resolvePositionValue(vaultDirectValue, vaultShares) + resolvePositionValue(stakingDirectValue, stakingShares)
  if (!Number.isFinite(totalValue)) {
    return 0
  }
  return totalValue
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

export function extractHoldingsVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVaultInput[] {
  return Array.from(vaultMap.values())
    .filter(({ hasHoldings }) => hasHoldings)
    .map(({ vault }) => vault)
}

export function extractAvailableVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVaultInput[] {
  return Array.from(vaultMap.values())
    .filter(({ hasAvailableBalance }) => hasAvailableBalance)
    .map(({ vault }) => vault)
}
