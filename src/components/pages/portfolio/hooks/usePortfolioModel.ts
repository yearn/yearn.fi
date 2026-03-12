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
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
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
import { toAddress } from '@shared/utils'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useCallback, useMemo, useState } from 'react'

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
    balances
  } = useWallet()
  const { isActive, openLoginModal, isUserConnecting, isIdentityLoading } = useWeb3()
  const { getPrice, vaults, isLoadingVaultList } = useYearn()
  const { listVault: yvUsdVault, unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
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
        unlockedApy: yvUsdUnlockedVault ? calculateVaultHistoricalAPY(yvUsdUnlockedVault) : null,
        lockedApy: yvUsdLockedVault ? calculateVaultHistoricalAPY(yvUsdLockedVault) : null
      }),
      combinedValue: unlockedValue + lockedValue,
      hasHoldings: unlockedBalance.raw > 0n || lockedBalance.raw > 0n
    }
  }, [getBalance, yvUsdLockedVault, yvUsdUnlockedVault])

  const vaultLookup = useMemo(() => {
    const map = new Map<string, TKongVaultInput>()

    Object.values(vaults).forEach((vault) => {
      if (isYvUsdAddress(getVaultAddress(vault))) {
        return
      }
      const vaultKey = getVaultKey(vault)
      map.set(vaultKey, vault)

      const staking = getVaultStaking(vault)
      if (staking?.available && staking.address) {
        const stakingKey = getChainAddressKey(getVaultChainID(vault), staking.address)
        map.set(stakingKey, vault)
      }
    })

    return map
  }, [vaults])

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
      result.push(yvUsdVault)
    }

    return result
  }, [balances, vaultLookup, yvUsdPosition.hasHoldings, yvUsdVault])

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
  const isHoldingsLoading = (isLoadingVaultList && isActive) || isSearchingBalances

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
      return apy === 0 ? null : apy
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

      const chainID = getVaultChainID(vault)
      const address = getVaultAddress(vault)
      const staking = getVaultStaking(vault)

      const shareBalance = getBalance({
        address,
        chainID
      })
      const price = getPrice({
        address,
        chainID
      })
      const baseValue = shareBalance.normalized * price.normalized

      if (!staking?.available || !staking.address) {
        return baseValue
      }

      const stakingValue =
        getBalance({
          address: staking.address,
          chainID
        }).normalized * price.normalized

      return baseValue + stakingValue
    },
    [getBalance, getPrice, yvUsdPosition.combinedValue]
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
