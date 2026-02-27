import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultMigration,
  getVaultStaking,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { getVaultHoldingsUsd } from '@pages/vaults/utils/holdingsValue'
import { deriveListKind, isAllocatorVaultOverride } from '@pages/vaults/utils/vaultListFacets'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useMemo, useState } from 'react'

type THoldingsRow = {
  key: string
  vault: TKongVault
  hrefOverride?: string
}

type TSuggestedVaultRow = {
  key: string
  vault: TKongVault
}

export type TPortfolioBlendedMetrics = {
  blendedCurrentAPY: number | null
  blendedHistoricalAPY: number | null
  estimatedAnnualReturn: number | null
}

export type TPortfolioModel = {
  blendedMetrics: TPortfolioBlendedMetrics
  hasHoldings: boolean
  holdingsRows: THoldingsRow[]
  isActive: boolean
  isHoldingsLoading: boolean
  isSearchingBalances: boolean
  hasKatanaHoldings: boolean
  openLoginModal: () => void
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
  suggestedRows: TSuggestedVaultRow[]
  totalPortfolioValue: number
  vaultFlags: Record<string, TVaultFlags>
  setSortBy: TSortStateSetter<TPossibleSortBy>
  setSortDirection: TSortStateSetter<TSortDirection>
}

type TSortStateSetter<T> = (value: T | ((previous: T) => T)) => void

function getChainAddressKey(chainID: number | undefined, address: string): string {
  return `${chainID}_${toAddress(address)}`
}

function isPortfolioV3Vault(vault: TKongVault): boolean {
  return isV3Vault(vault, isAllocatorVaultOverride(vault))
}

export function usePortfolioModel(): TPortfolioModel {
  const {
    cumulatedValueInV2Vaults,
    cumulatedValueInV3Vaults,
    isLoading: isWalletLoading,
    getBalance,
    balances
  } = useWallet()
  const { isActive, openLoginModal, isUserConnecting, isIdentityLoading } = useWeb3()
  const { getPrice, katanaAprs, vaults, isLoadingVaultList } = useYearn()
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('deposited')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  const vaultLookup = useMemo(() => {
    const map = new Map<string, TKongVault>()

    Object.values(vaults).forEach((vault) => {
      const vaultKey = getVaultKey(vault)
      map.set(vaultKey, vault)

      const staking = getVaultStaking(vault)
      if (staking?.address && !isZeroAddress(staking.address)) {
        const stakingKey = getChainAddressKey(getVaultChainID(vault), staking.address)
        map.set(stakingKey, vault)
      }
    })

    return map
  }, [vaults])

  const holdingsVaults = useMemo(() => {
    const result: TKongVault[] = []
    const seen = new Set<string>()

    Object.entries(balances || {}).forEach(([chainIDKey, perChain]) => {
      const parsedChainID = Number(chainIDKey)
      const chainID = Number.isFinite(parsedChainID) ? parsedChainID : undefined
      Object.values(perChain || {}).forEach((token) => {
        if (!token?.balance || token.balance.raw <= 0n) {
          return
        }
        const tokenChainID = chainID ?? token.chainID
        const tokenKey = getChainAddressKey(tokenChainID, token.address)
        const vault = vaultLookup.get(tokenKey)
        if (!vault) {
          return
        }
        const vaultKey = getVaultKey(vault)
        if (seen.has(vaultKey)) {
          return
        }
        seen.add(vaultKey)
        result.push(vault)
      })
    })

    return result
  }, [balances, vaultLookup])

  const vaultFlags = useMemo(() => {
    const flags: Record<string, TVaultFlags> = {}

    holdingsVaults.forEach((vault) => {
      const key = getVaultKey(vault)
      const info = getVaultInfo(vault)
      const migration = getVaultMigration(vault)
      flags[key] = {
        hasHoldings: true,
        isMigratable: Boolean(migration?.available),
        isRetired: Boolean(info?.isRetired),
        isHidden: Boolean(info?.isHidden)
      }
    })

    return flags
  }, [holdingsVaults])

  const isSearchingBalances =
    (isActive || isUserConnecting) && (isWalletLoading || isUserConnecting || isIdentityLoading)
  const isLoading = isLoadingVaultList
  const isHoldingsLoading = (isLoading && isActive) || isSearchingBalances

  const suggestedVaultCandidates = useMemo(
    () =>
      Object.values(vaults).filter((vault) => {
        if (getVaultChainID(vault) !== KATANA_CHAIN_ID || deriveListKind(vault) !== 'allocator') {
          return false
        }

        const info = getVaultInfo(vault)
        const migration = getVaultMigration(vault)
        const isHidden = Boolean(info?.isHidden)
        const isRetired = Boolean(info?.isRetired)
        const isMigratable = Boolean(migration?.available)
        const isHighlighted = Boolean(info?.isHighlighted)

        return !isHidden && !isRetired && !isMigratable && isHighlighted
      }),
    [vaults]
  )

  const sortedHoldings = useSortVaults(holdingsVaults, sortBy, sortDirection)
  const sortedCandidates = useSortVaults(suggestedVaultCandidates, 'tvl', 'desc')

  const holdingsKeySet = useMemo(() => new Set(sortedHoldings.map((vault) => getVaultKey(vault))), [sortedHoldings])

  const suggestedVaults = useMemo(
    () => sortedCandidates.filter((vault) => !holdingsKeySet.has(getVaultKey(vault))).slice(0, 4),
    [sortedCandidates, holdingsKeySet]
  )

  const holdingsRows = useMemo(() => {
    return sortedHoldings.map((vault) => {
      const key = getVaultKey(vault)
      const hrefOverride = isPortfolioV3Vault(vault)
        ? undefined
        : `/vaults/${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`
      return { key, vault, hrefOverride }
    })
  }, [sortedHoldings])

  const suggestedRows = useMemo(
    () => suggestedVaults.map((vault) => ({ key: getVaultKey(vault), vault })),
    [suggestedVaults]
  )

  const hasHoldings = sortedHoldings.length > 0
  const hasKatanaHoldings = useMemo(
    () => holdingsVaults.some((vault) => getVaultChainID(vault) === KATANA_CHAIN_ID),
    [holdingsVaults]
  )
  const totalPortfolioValue = (cumulatedValueInV2Vaults || 0) + (cumulatedValueInV3Vaults || 0)

  const getVaultEstimatedAPY = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number | null => {
        const apy = calculateVaultEstimatedAPY(vault, katanaAprs)
        return apy === 0 ? null : apy
      },
    [katanaAprs]
  )

  const getVaultHistoricalAPY = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number | null => {
        return calculateVaultHistoricalAPY(vault, katanaAprs)
      },
    [katanaAprs]
  )

  const getVaultValue = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number => {
        return getVaultHoldingsUsd(vault, getBalance, getPrice)
      },
    [getBalance, getPrice]
  )

  const blendedMetrics = useMemo(() => {
    const { totalValue, weightedCurrent, weightedHistorical, hasCurrent, hasHistorical } = holdingsVaults.reduce(
      (acc, vault) => {
        const value = getVaultValue(vault)
        if (!Number.isFinite(value) || value <= 0) {
          return acc
        }

        const estimatedAPY = getVaultEstimatedAPY(vault)
        const newWeightedCurrent =
          typeof estimatedAPY === 'number' && Number.isFinite(estimatedAPY)
            ? acc.weightedCurrent + value * estimatedAPY
            : acc.weightedCurrent
        const newHasCurrent = acc.hasCurrent || (typeof estimatedAPY === 'number' && Number.isFinite(estimatedAPY))

        const historicalAPY = getVaultHistoricalAPY(vault)
        const newWeightedHistorical =
          typeof historicalAPY === 'number' && Number.isFinite(historicalAPY)
            ? acc.weightedHistorical + value * historicalAPY
            : acc.weightedHistorical
        const newHasHistorical =
          acc.hasHistorical || (typeof historicalAPY === 'number' && Number.isFinite(historicalAPY))

        return {
          totalValue: acc.totalValue + value,
          weightedCurrent: newWeightedCurrent,
          weightedHistorical: newWeightedHistorical,
          hasCurrent: newHasCurrent,
          hasHistorical: newHasHistorical
        }
      },
      { totalValue: 0, weightedCurrent: 0, weightedHistorical: 0, hasCurrent: false, hasHistorical: false }
    )

    const blendedCurrentAPY = totalValue > 0 && hasCurrent ? weightedCurrent / totalValue : null
    const blendedHistoricalAPY = totalValue > 0 && hasHistorical ? weightedHistorical / totalValue : null
    const blendedCurrentAPYPercent = blendedCurrentAPY !== null ? blendedCurrentAPY * 100 : null
    const blendedHistoricalAPYPercent = blendedHistoricalAPY !== null ? blendedHistoricalAPY * 100 : null
    const estimatedAnnualReturn = blendedCurrentAPY !== null ? totalPortfolioValue * blendedCurrentAPY : null

    return {
      blendedCurrentAPY: blendedCurrentAPYPercent,
      blendedHistoricalAPY: blendedHistoricalAPYPercent,
      estimatedAnnualReturn
    }
  }, [getVaultEstimatedAPY, getVaultHistoricalAPY, getVaultValue, holdingsVaults, totalPortfolioValue])

  return {
    blendedMetrics,
    hasHoldings,
    holdingsRows,
    isActive,
    isHoldingsLoading,
    isSearchingBalances,
    hasKatanaHoldings,
    openLoginModal,
    sortBy,
    sortDirection,
    suggestedRows,
    totalPortfolioValue,
    vaultFlags,
    setSortBy,
    setSortDirection
  }
}
