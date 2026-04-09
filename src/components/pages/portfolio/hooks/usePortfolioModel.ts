'use client'

import { useTokenSuggestions } from '@pages/portfolio/hooks/useTokenSuggestions'
import { useVaultSuggestions } from '@pages/portfolio/hooks/useVaultSuggestions'
import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultMigration,
  getVaultStaking,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { isNonYearnErc4626Vault } from '@pages/vaults/domain/vaultWarnings'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { useYvUsdCharts } from '@pages/vaults/hooks/useYvUsdCharts'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { usePersistedShowHiddenVaults } from '@pages/vaults/hooks/vaultsFiltersStorage'
import { deriveListKind, isAllocatorVaultOverride } from '@pages/vaults/utils/vaultListFacets'
import {
  getWeightedYvUsdApy,
  getYvUsdSharePrice,
  isYvUsdAddress,
  isYvUsdVault,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useCallback, useMemo, useState } from 'react'
import { filterVisiblePortfolioHoldings } from './portfolioVisibility'

type THoldingsRow = {
  key: string
  vault: TKongVaultInput
  hrefOverride?: string
}

export type TSuggestedItem =
  | { type: 'external'; key: string; vault: TKongVault; externalProtocol: string; underlyingSymbol: string }
  | { type: 'personalized'; key: string; vault: TKongVault; matchedSymbol: string }
  | { type: 'generic'; key: string; vault: TKongVault }

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
  suggestedRows: TSuggestedItem[]
  totalPortfolioValue: number
  vaultFlags: Record<string, TVaultFlags>
  setSortBy: TSortStateSetter<TPossibleSortBy>
  setSortDirection: TSortStateSetter<TSortDirection>
}

type TSortStateSetter<T> = (value: T | ((previous: T) => T)) => void
type TYvUsdPortfolioPosition = {
  blendedCurrentApy: number | null
  blendedHistoricalApy: number | null
  combinedValue: number
  hasHoldings: boolean
}

function getLatestYvUsdHistoricalApyValue(
  apyData: ReturnType<typeof useYvUsdCharts>['apyData'],
  variant: 'locked' | 'unlocked'
): number | null {
  if (!apyData || apyData.length === 0) {
    return null
  }

  const latestValue = apyData[apyData.length - 1]?.[variant]
  if (typeof latestValue !== 'number' || !Number.isFinite(latestValue)) {
    return null
  }

  return latestValue / 100
}

function getChainAddressKey(chainID: number | undefined, address: string): string {
  return `${chainID}_${toAddress(address)}`
}

function isPortfolioV3Vault(vault: TKongVaultInput): boolean {
  return isV3Vault(vault, isAllocatorVaultOverride(vault))
}

function getPortfolioRowHref(vault: TKongVaultInput): string | undefined {
  if (isPortfolioV3Vault(vault)) {
    return undefined
  }
  return `/vaults/${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`
}

export function usePortfolioModel(): TPortfolioModel {
  const {
    cumulatedValueInV2Vaults,
    cumulatedValueInV3Vaults,
    isLoading: isWalletLoading,
    getBalance,
    getVaultHoldingsUsd,
    balances
  } = useWallet()
  const { isActive, openLoginModal, isUserConnecting, isIdentityLoading } = useWeb3()
  const { vaults, allVaults, isLoadingVaultList } = useYearn()
  const { listVault: yvUsdVault, unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const { apyData: yvUsdHistoricalApyData } = useYvUsdCharts()
  const showHiddenVaults = usePersistedShowHiddenVaults()
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('deposited')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  const yvUsdPosition = useMemo<TYvUsdPortfolioPosition>(() => {
    const unlockedBalance = getBalance({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID })
    const lockedBalance = getBalance({ address: YVUSD_LOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID })
    const unlockedValue = unlockedBalance.normalized * getYvUsdSharePrice(yvUsdUnlockedVault)
    const lockedValue = lockedBalance.normalized * getYvUsdSharePrice(yvUsdLockedVault)

    return {
      blendedCurrentApy: getWeightedYvUsdApy({
        unlockedValue,
        lockedValue,
        unlockedApy: yvUsdUnlockedVault ? calculateVaultEstimatedAPY(yvUsdUnlockedVault) || null : null,
        lockedApy: yvUsdLockedVault ? calculateVaultEstimatedAPY(yvUsdLockedVault) || null : null
      }),
      blendedHistoricalApy: getWeightedYvUsdApy({
        unlockedValue,
        lockedValue,
        unlockedApy: getLatestYvUsdHistoricalApyValue(yvUsdHistoricalApyData, 'unlocked'),
        lockedApy: getLatestYvUsdHistoricalApyValue(yvUsdHistoricalApyData, 'locked')
      }),
      combinedValue: unlockedValue + lockedValue,
      hasHoldings: unlockedBalance.raw > 0n || lockedBalance.raw > 0n
    }
  }, [getBalance, yvUsdHistoricalApyData, yvUsdLockedVault, yvUsdUnlockedVault])

  const vaultLookup = useMemo(() => {
    const map = new Map<string, TKongVaultInput>()

    Object.values(allVaults).forEach((vault) => {
      if (isYvUsdAddress(getVaultAddress(vault))) {
        return
      }
      const canonicalVaultAddress = getCanonicalHoldingsVaultAddress(getVaultAddress(vault))
      const canonicalVault = allVaults[canonicalVaultAddress] ?? vault
      const vaultKey = getVaultKey(canonicalVault)
      if (!map.has(vaultKey)) {
        map.set(vaultKey, canonicalVault)
      }

      const staking = getVaultStaking(vault)
      if (!isZeroAddress(staking.address)) {
        const stakingKey = getChainAddressKey(getVaultChainID(canonicalVault), staking.address)
        if (!map.has(stakingKey)) {
          map.set(stakingKey, canonicalVault)
        }
      }

      const directKey = getChainAddressKey(getVaultChainID(canonicalVault), getVaultAddress(vault))
      if (!map.has(directKey)) {
        map.set(directKey, canonicalVault)
      }
    })

    return map
  }, [allVaults])

  const holdingsVaults = useMemo(() => {
    const result: TKongVaultInput[] = []
    const seen = new Set<string>()

    Object.entries(balances || {}).forEach(([chainIDKey, perChain]) => {
      const parsedChainID = Number(chainIDKey)
      const chainID = Number.isFinite(parsedChainID) ? parsedChainID : undefined
      Object.values(perChain || {}).forEach((token) => {
        if (!token?.balance || token.balance.raw <= 0n) {
          return
        }
        if (isYvUsdAddress(token.address)) {
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

    if (yvUsdVault && yvUsdPosition.hasHoldings) {
      const yvUsdKey = getVaultKey(yvUsdVault)
      if (!seen.has(yvUsdKey)) {
        seen.add(yvUsdKey)
        result.push(yvUsdVault)
      }
    }

    return result
  }, [balances, vaultLookup, yvUsdPosition.hasHoldings, yvUsdVault])

  const visibleHoldingsVaults = useMemo(
    () => filterVisiblePortfolioHoldings(holdingsVaults, showHiddenVaults),
    [holdingsVaults, showHiddenVaults]
  )

  const vaultFlags = useMemo(() => {
    const flags: Record<string, TVaultFlags> = {}

    visibleHoldingsVaults.forEach((vault) => {
      const key = getVaultKey(vault)
      flags[key] = {
        hasHoldings: true,
        isMigratable: Boolean(getVaultMigration(vault)?.available),
        isRetired: Boolean(getVaultInfo(vault)?.isRetired),
        isHidden: Boolean(getVaultInfo(vault)?.isHidden),
        isNotYearn: isYvUsdVault(vault) ? false : isNonYearnErc4626Vault({ vault: vault as TKongVault })
      }
    })

    return flags
  }, [visibleHoldingsVaults])

  const isSearchingBalances =
    (isActive || isUserConnecting) && (isWalletLoading || isUserConnecting || isIdentityLoading)
  const isHoldingsLoading = (isLoadingVaultList && isActive) || isSearchingBalances

  const suggestedVaultCandidates = useMemo(
    () =>
      Object.values(vaults).filter((vault) => {
        if (getVaultChainID(vault) !== KATANA_CHAIN_ID || deriveListKind(vault) !== 'allocator') {
          return false
        }

        const isHidden = Boolean(getVaultInfo(vault)?.isHidden)
        const isRetired = Boolean(getVaultInfo(vault)?.isRetired)
        const isMigratable = Boolean(getVaultMigration(vault)?.available)
        const isHighlighted = Boolean(getVaultInfo(vault)?.isHighlighted)

        return !isHidden && !isRetired && !isMigratable && isHighlighted
      }),
    [vaults]
  )

  const sortedHoldings = useSortVaults(visibleHoldingsVaults, sortBy, sortDirection)
  const sortedCandidates = useSortVaults(suggestedVaultCandidates, 'tvl', 'desc')

  const holdingsKeySet = useMemo(() => new Set(sortedHoldings.map((vault) => getVaultKey(vault))), [sortedHoldings])

  const genericVaults = useMemo(
    () => sortedCandidates.filter((vault) => !holdingsKeySet.has(getVaultKey(vault))).slice(0, 4),
    [sortedCandidates, holdingsKeySet]
  )

  const tokenSuggestions = useTokenSuggestions(holdingsKeySet)
  const { suggestions: vaultSuggestions } = useVaultSuggestions(holdingsKeySet)

  const holdingsRows = useMemo(
    () =>
      sortedHoldings.map((vault) => ({
        key: getVaultKey(vault),
        vault,
        hrefOverride: getPortfolioRowHref(vault)
      })),
    [sortedHoldings]
  )

  const suggestedRows = useMemo((): TSuggestedItem[] => {
    const candidates: { item: TSuggestedItem; vaultKey: string }[] = [
      ...vaultSuggestions.slice(0, 2).map((ext) => ({
        item: {
          type: 'external' as const,
          key: `ext-${getVaultKey(ext.vault)}`,
          vault: ext.vault,
          externalProtocol: ext.externalProtocol,
          underlyingSymbol: ext.underlyingSymbol
        },
        vaultKey: getVaultKey(ext.vault)
      })),
      ...tokenSuggestions.map((ps) => ({
        item: {
          type: 'personalized' as const,
          key: `pers-${getVaultKey(ps.vault)}`,
          vault: ps.vault,
          matchedSymbol: ps.matchedSymbol
        },
        vaultKey: getVaultKey(ps.vault)
      })),
      ...genericVaults.map((vault) => ({
        item: { type: 'generic' as const, key: `gen-${getVaultKey(vault)}`, vault },
        vaultKey: getVaultKey(vault)
      }))
    ]

    const seen = new Set<string>()
    return candidates
      .filter(({ vaultKey }) => {
        if (seen.has(vaultKey)) return false
        seen.add(vaultKey)
        return true
      })
      .slice(0, 4)
      .map(({ item }) => item)
  }, [vaultSuggestions, tokenSuggestions, genericVaults])

  const hasHoldings = sortedHoldings.length > 0
  const hasKatanaHoldings = useMemo(
    () => holdingsVaults.some((vault) => getVaultChainID(vault) === KATANA_CHAIN_ID),
    [holdingsVaults]
  )
  const totalPortfolioValue = (cumulatedValueInV2Vaults || 0) + (cumulatedValueInV3Vaults || 0)

  const getVaultEstimatedAPY = useCallback(
    (vault: (typeof holdingsVaults)[number]): number | null => {
      if (isYvUsdVault(vault)) {
        return yvUsdPosition.blendedCurrentApy
      }

      const apy = calculateVaultEstimatedAPY(vault)
      const hasHistoricalNet = 'performance' in vault && Boolean(vault.performance?.historical?.net)
      return apy === 0 && !hasHistoricalNet ? null : apy
    },
    [yvUsdPosition.blendedCurrentApy]
  )

  const getVaultHistoricalAPY = useCallback(
    (vault: (typeof holdingsVaults)[number]): number | null => {
      if (isYvUsdVault(vault)) {
        return yvUsdPosition.blendedHistoricalApy
      }

      return calculateVaultHistoricalAPY(vault)
    },
    [yvUsdPosition.blendedHistoricalApy]
  )

  const getVaultValue = useCallback(
    (vault: (typeof holdingsVaults)[number]): number => {
      if (isYvUsdVault(vault)) {
        return yvUsdPosition.combinedValue
      }

      return getVaultHoldingsUsd(vault)
    },
    [getVaultHoldingsUsd, yvUsdPosition.combinedValue]
  )

  const blendedMetrics = useMemo(() => {
    const isFiniteNumber = (v: number | null): v is number => v !== null && Number.isFinite(v)

    const { totalValue, weightedCurrent, weightedHistorical, hasCurrent, hasHistorical } = holdingsVaults.reduce(
      (acc, vault) => {
        const value = getVaultValue(vault)
        if (!Number.isFinite(value) || value <= 0) return acc

        const estimatedAPY = getVaultEstimatedAPY(vault)
        const historicalAPY = getVaultHistoricalAPY(vault)

        return {
          totalValue: acc.totalValue + value,
          weightedCurrent: acc.weightedCurrent + (isFiniteNumber(estimatedAPY) ? value * estimatedAPY : 0),
          weightedHistorical: acc.weightedHistorical + (isFiniteNumber(historicalAPY) ? value * historicalAPY : 0),
          hasCurrent: acc.hasCurrent || isFiniteNumber(estimatedAPY),
          hasHistorical: acc.hasHistorical || isFiniteNumber(historicalAPY)
        }
      },
      { totalValue: 0, weightedCurrent: 0, weightedHistorical: 0, hasCurrent: false, hasHistorical: false }
    )

    const blendedCurrentAPY = totalValue > 0 && hasCurrent ? (weightedCurrent / totalValue) * 100 : null
    const blendedHistoricalAPY = totalValue > 0 && hasHistorical ? (weightedHistorical / totalValue) * 100 : null
    const estimatedAnnualReturn =
      totalValue > 0 && hasCurrent ? totalPortfolioValue * (weightedCurrent / totalValue) : null

    return { blendedCurrentAPY, blendedHistoricalAPY, estimatedAnnualReturn }
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
