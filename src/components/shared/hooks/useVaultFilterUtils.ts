import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultDecimals,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  getVaultVersion,
  isYieldSplitterVault,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { getNativeTokenWrapperContract } from '@pages/vaults/utils/nativeTokens'
import type { TDict } from '@shared/types'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'

type TVaultLike = TKongVaultInput

export type TVaultWithMetadata = {
  vault: TVaultLike
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
  isNotYearn?: boolean
  yieldModeLabel?: string
  yieldModeTooltip?: string
}

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceGetter = (params: TTokenAndChain) => TNormalizedBN
type TPriceGetter = (params: TTokenAndChain) => { normalized: number }
type TTokenGetter = (params: TTokenAndChain) => { value?: number }
type TStakingConversionMap = Record<string, bigint>

type TVaultHoldingsUsdOptions = {
  allVaults?: TDict<TVaultLike>
  stakingConvertedAssets?: TStakingConversionMap
}

const getVaultSharePriceUsd = (vault: TVaultLike, getPrice: TPriceGetter): number => {
  const chainID = getVaultChainID(vault)
  const vaultAddress = getVaultAddress(vault)
  const directSharePrice = getPrice({ address: vaultAddress, chainID }).normalized
  if (directSharePrice > 0) {
    return directSharePrice
  }

  const assetToken = getVaultToken(vault)
  const assetPrice = getPrice({ address: assetToken.address, chainID }).normalized
  const pricePerShare = getVaultAPR(vault).pricePerShare.today
  if (assetPrice > 0 && pricePerShare > 0) {
    return assetPrice * pricePerShare
  }

  return getVaultTVL(vault).price
}

export function createCheckHasHoldings(
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter,
  shouldHideDust: boolean
): (vault: TVaultLike) => boolean {
  return function checkHasHoldings(vault: TVaultLike): boolean {
    const address = getVaultAddress(vault)
    const chainID = getVaultChainID(vault)
    const vaultDecimals = getVaultDecimals(vault)
    const staking = getVaultStaking(vault)

    const vaultBalance = getBalance({ address, chainID })
    const hasVaultBalance = vaultBalance.raw > 0n
    const sharePriceUsd = getVaultSharePriceUsd(vault, getPrice)

    if (!isZeroAddress(staking.address)) {
      const stakingBalance = getBalance({
        address: staking.address,
        chainID
      })
      const hasValidStakedBalance = stakingBalance.raw > 0n
      if (hasValidStakedBalance) {
        if (sharePriceUsd <= 0) {
          return true
        }
        const stakedBalance = toNormalizedBN(stakingBalance.raw, vaultDecimals).normalized
        const stakedBalanceValue = stakedBalance * sharePriceUsd
        if (!(shouldHideDust && stakedBalanceValue < 0.01)) {
          return true
        }
      }
    }

    if (!hasVaultBalance) {
      return false
    }

    if (sharePriceUsd <= 0) {
      return true
    }
    const balanceValue = toNormalizedBN(vaultBalance.raw, vaultDecimals).normalized * sharePriceUsd

    return !(shouldHideDust && balanceValue < 0.01)
  }
}

export function createCheckHasAvailableBalance(getBalance: TBalanceGetter): (vault: TVaultLike) => boolean {
  return function checkHasAvailableBalance(vault: TVaultLike): boolean {
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
  vault: TVaultLike,
  getToken: TTokenGetter,
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter,
  options?: TVaultHoldingsUsdOptions
): number {
  const chainID = getVaultChainID(vault)
  const address = toAddress(getVaultAddress(vault))
  const allVaults = options?.allVaults ?? {}
  const stakingConvertedAssets = options?.stakingConvertedAssets ?? {}
  const canonicalAddress = getCanonicalHoldingsVaultAddress(address)

  const resolvePositionValue = (positionVault: TVaultLike, directValue: number, shares: number): number => {
    if (Number.isFinite(directValue) && directValue > 0) {
      return directValue
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      return 0
    }
    const positionChainID = getVaultChainID(positionVault)
    const positionAddress = getVaultAddress(positionVault)
    const positionToken = getVaultToken(positionVault)
    const vaultSharePrice = Number(getPrice({ address: positionAddress, chainID: positionChainID }).normalized || 0)
    const pricePerShare = Number(getVaultAPR(positionVault).pricePerShare.today || 0)
    const resolvedAssetPrice = Number(
      getPrice({ address: positionToken.address, chainID: positionChainID }).normalized || 0
    )
    const assetPrice = resolvedAssetPrice > 0 ? resolvedAssetPrice : Number(getVaultTVL(positionVault).price || 0)

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

  const positionVaults = Object.values(allVaults).filter((candidateVault) => {
    return (
      getVaultChainID(candidateVault) === chainID &&
      getCanonicalHoldingsVaultAddress(getVaultAddress(candidateVault)) === canonicalAddress
    )
  })
  const resolvedPositionVaults = positionVaults.length > 0 ? positionVaults : [vault]
  const directPositionAddresses = new Set(
    resolvedPositionVaults.map((candidateVault) => toAddress(getVaultAddress(candidateVault)))
  )

  const totalValue = resolvedPositionVaults.reduce((total, candidateVault) => {
    const candidateChainID = getVaultChainID(candidateVault)
    const candidateAddress = toAddress(getVaultAddress(candidateVault))
    const candidateToken = getToken({ address: candidateAddress, chainID: candidateChainID })
    const directValue = Number(candidateToken.value || 0)
    const directShares = Number(getBalance({ address: candidateAddress, chainID: candidateChainID }).normalized || 0)
    const directPositionValue = resolvePositionValue(candidateVault, directValue, directShares)

    const staking = getVaultStaking(candidateVault)
    const stakingAddress = !isZeroAddress(staking.address) ? toAddress(staking.address) : undefined
    if (!stakingAddress || directPositionAddresses.has(stakingAddress)) {
      return total + directPositionValue
    }

    const stakingToken = getToken({ address: stakingAddress, chainID: candidateChainID })
    const stakingDirectValue = Number(stakingToken.value || 0)
    const stakingShares = Number(getBalance({ address: stakingAddress, chainID: candidateChainID }).normalized || 0)
    const stakingConversionKey = `${candidateChainID}/${stakingAddress}`
    const convertedStakingAssets = stakingConvertedAssets[stakingConversionKey]
    const stakingVault = allVaults[stakingAddress]

    const stakingPositionValue = (() => {
      if (Number.isFinite(stakingDirectValue) && stakingDirectValue > 0) {
        return stakingDirectValue
      }

      if (stakingVault) {
        return resolvePositionValue(stakingVault, 0, stakingShares)
      }

      if (convertedStakingAssets !== undefined && convertedStakingAssets > 0n) {
        const convertedShares = toNormalizedBN(
          convertedStakingAssets,
          getVaultDecimals(stakingVault ?? candidateVault)
        ).normalized
        return resolvePositionValue(stakingVault ?? candidateVault, 0, convertedShares)
      }

      return resolvePositionValue(candidateVault, 0, stakingShares)
    })()

    return total + directPositionValue + stakingPositionValue
  }, 0)

  if (!Number.isFinite(totalValue)) {
    return 0
  }
  return totalValue
}

export function getVaultKey(vault: TVaultLike): string {
  return `${getVaultChainID(vault)}_${toAddress(getVaultAddress(vault))}`
}

export function matchesSearch(vault: TVaultLike, search: string): boolean {
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

export function matchesSelectedChains(chainID: number, chains: number[] | null | undefined): boolean {
  return !chains?.length || chains.includes(chainID)
}

export function isV3Vault(vault: TVaultLike, isAllocatorOverride: boolean): boolean {
  const version = getVaultVersion(vault)
  return version.startsWith('3') || version.startsWith('~3') || isAllocatorOverride || isYieldSplitterVault(vault)
}

export function extractHoldingsVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasHoldings }) => hasHoldings)
    .map(({ vault }) => vault as TKongVault)
}

export function extractAvailableVaults(vaultMap: Map<string, TVaultWithMetadata>): TKongVault[] {
  return Array.from(vaultMap.values())
    .filter(({ hasAvailableBalance }) => hasAvailableBalance)
    .map(({ vault }) => vault as TKongVault)
}
