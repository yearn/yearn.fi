import { getNativeTokenWrapperContract } from '@pages/vaults/utils/nativeTokens'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'

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
type TTokenGetter = (params: TTokenAndChain) => { value?: number }

export function createCheckHasHoldings(
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter,
  shouldHideDust: boolean
): (vault: TYDaemonVault) => boolean {
  return function checkHasHoldings(vault: TYDaemonVault): boolean {
    const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
    const hasVaultBalance = vaultBalance.raw > 0n
    const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

    if (!isZeroAddress(vault.staking.address)) {
      const stakingBalance = getBalance({
        address: vault.staking.address,
        chainID: vault.chainID
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

export function getVaultHoldingsUsdValue(
  vault: TYDaemonVault,
  getToken: TTokenGetter,
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter
): number {
  const vaultToken = getToken({ address: vault.address, chainID: vault.chainID })
  const vaultDirectValue = Number(vaultToken.value || 0)
  const vaultShares = Number(getBalance({ address: vault.address, chainID: vault.chainID }).normalized || 0)

  const canUseStaking = !isZeroAddress(vault.staking.address)
  const stakingToken = canUseStaking ? getToken({ address: vault.staking.address, chainID: vault.chainID }) : null
  const stakingDirectValue = Number(stakingToken?.value || 0)
  const stakingShares = canUseStaking
    ? Number(getBalance({ address: vault.staking.address, chainID: vault.chainID }).normalized || 0)
    : 0

  const vaultSharePrice = Number(getPrice({ address: vault.address, chainID: vault.chainID }).normalized || 0)
  const pricePerShare = Number(vault.apr?.pricePerShare?.today || 0)
  const resolvedAssetPrice = Number(getPrice({ address: vault.token.address, chainID: vault.chainID }).normalized || 0)
  const assetPrice = resolvedAssetPrice > 0 ? resolvedAssetPrice : Number(vault.tvl?.price || 0)

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
