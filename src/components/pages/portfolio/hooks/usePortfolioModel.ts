import { normalizeSymbol } from '@pages/portfolio/hooks/getEligibleVaults'
import { useTokenSuggestions } from '@pages/portfolio/hooks/useTokenSuggestions'
import { useVaultSuggestions } from '@pages/portfolio/hooks/useVaultSuggestions'
import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
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
import { useWalletVaultTotals } from '@shared/contexts/useWalletVaultTotals'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useCallback, useMemo, useState } from 'react'
import type { TPortfolioLiveBalanceSnapshot } from '../types/api'
import { filterVisiblePortfolioHoldings } from './portfolioVisibility'
import { hasYvUsdPortfolioHoldings, resolveYvUsdFollowOnSuggestionVault } from './usePortfolioModel.helpers'

type THoldingsRow = {
  key: string
  vault: TKongVaultInput
  hrefOverride?: string
}

export type TSuggestedItem =
  | {
      type: 'external'
      key: string
      vault: TKongVaultInput
      externalProtocol: string
      underlyingSymbol: string
      matchedChainID: number
    }
  | { type: 'personalized'; key: string; vault: TKongVaultInput; matchedSymbol: string; matchedChainID: number }
  | { type: 'generic'; key: string; vault: TKongVaultInput }

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
  liveBalanceSnapshot: TPortfolioLiveBalanceSnapshot | null
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
type TStablecoinHoldingMatch = { symbol: string; chainID: number } | null

const STABLECOIN_SUGGESTION_SYMBOLS = new Set([
  'AUSD',
  'BOLD',
  'CRVUSD',
  'DAI',
  'DOLA',
  'FRAX',
  'GHO',
  'LUSD',
  'MIM',
  'PYUSD',
  'SDAI',
  'SUSDE',
  'TUSD',
  'USDC',
  'USDD',
  'USDE',
  'USDP',
  'USDS',
  'USDT',
  'USD0'
])

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

function getStablecoinHoldingMatch(balances: ReturnType<typeof useWallet>['balances']): TStablecoinHoldingMatch {
  return (
    Object.entries(balances ?? {})
      .flatMap(([chainIDKey, perChain]) =>
        Object.values(perChain ?? {})
          .filter((token) => {
            const symbol = normalizeSymbol(token?.symbol ?? '')
            return Boolean(token?.balance && token.balance.raw > 0n && STABLECOIN_SUGGESTION_SYMBOLS.has(symbol))
          })
          .map((token) => {
            const parsedChainID = Number(chainIDKey)
            return {
              chainID: Number.isFinite(parsedChainID) ? parsedChainID : token.chainID,
              symbol: normalizeSymbol(token.symbol),
              value: token.value
            }
          })
      )
      .sort((a, b) => b.value - a.value)[0] ?? null
  )
}

export function usePortfolioModel(): TPortfolioModel {
  const { isLoading: isWalletLoading, hasCompletedBalanceLoad, getBalance, getVaultHoldingsUsd, balances } = useWallet()
  const { totalValue: totalPortfolioValue } = useWalletVaultTotals()
  const { isActive, openLoginModal, isUserConnecting, isIdentityLoading } = useWeb3()
  const { vaults, allVaults, isLoadingVaultList, getPrice } = useYearn()
  const { listVault: yvUsdVault, unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const { apyData: yvUsdHistoricalApyData } = useYvUsdCharts()
  const { shouldHideDust } = useAppSettings()
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

  const visibleHoldingsVaults = useMemo(
    () =>
      filterVisiblePortfolioHoldings(holdingsVaults, showHiddenVaults, {
        shouldHideDust,
        getVaultValue
      }),
    [getVaultValue, holdingsVaults, shouldHideDust, showHiddenVaults]
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
  const isHoldingsLoading = (isLoadingVaultList && isActive) || isSearchingBalances || !hasCompletedBalanceLoad

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
  const yvUsdSuggestedVault = yvUsdLockedVault ?? allVaults[YVUSD_LOCKED_ADDRESS] ?? allVaults[YVUSD_UNLOCKED_ADDRESS]
  const stablecoinHoldingMatch = useMemo(() => getStablecoinHoldingMatch(balances), [balances])

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
    const yvUsdSuggestedVaultKey = yvUsdSuggestedVault ? getVaultKey(yvUsdSuggestedVault) : null
    const hasYvUsdHoldings = hasYvUsdPortfolioHoldings(holdingsKeySet)
    const yvUsdSuggestion =
      yvUsdSuggestedVault && yvUsdSuggestedVaultKey && !hasYvUsdHoldings
        ? {
            item: stablecoinHoldingMatch
              ? {
                  type: 'personalized' as const,
                  key: `pers-${yvUsdSuggestedVaultKey}-${stablecoinHoldingMatch.symbol.toLowerCase()}`,
                  vault: yvUsdSuggestedVault,
                  matchedSymbol: stablecoinHoldingMatch.symbol,
                  matchedChainID: stablecoinHoldingMatch.chainID
                }
              : {
                  type: 'generic' as const,
                  key: `gen-${yvUsdSuggestedVaultKey}`,
                  vault: yvUsdSuggestedVault
                },
            vaultKey: yvUsdSuggestedVaultKey
          }
        : null

    const getExternalVaultSuggestion = (vault: TKongVault): TKongVaultInput => {
      return resolveYvUsdFollowOnSuggestionVault({
        pinnedVault: yvUsdSuggestedVault,
        candidateVault: vault,
        unlockedVault: yvUsdUnlockedVault
      })
    }

    const candidates: { item: TSuggestedItem; vaultKey: string }[] = [
      ...(yvUsdSuggestion ? [yvUsdSuggestion] : []),
      ...vaultSuggestions.slice(0, 2).map((ext) => {
        const vault = getExternalVaultSuggestion(ext.vault)
        return {
          item: {
            type: 'external' as const,
            key: `ext-${getVaultKey(vault)}`,
            vault,
            externalProtocol: ext.externalProtocol,
            underlyingSymbol: ext.underlyingSymbol,
            matchedChainID: ext.matchedChainID
          },
          vaultKey: getVaultKey(vault)
        }
      }),
      ...tokenSuggestions.map((ps) => ({
        item: {
          type: 'personalized' as const,
          key: `pers-${getVaultKey(ps.vault)}`,
          vault: ps.vault,
          matchedSymbol: ps.matchedSymbol,
          matchedChainID: ps.matchedChainID
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
  }, [
    vaultSuggestions,
    tokenSuggestions,
    genericVaults,
    yvUsdSuggestedVault,
    yvUsdUnlockedVault,
    holdingsKeySet,
    stablecoinHoldingMatch
  ])

  const hasHoldings = sortedHoldings.length > 0
  const hasKatanaHoldings = useMemo(
    () => sortedHoldings.some((vault) => getVaultChainID(vault) === KATANA_CHAIN_ID),
    [sortedHoldings]
  )
  const ethPrice = getPrice({ address: ETH_TOKEN_ADDRESS, chainID: 1 }).normalized

  const liveBalanceSnapshot = useMemo<TPortfolioLiveBalanceSnapshot | null>(() => {
    if (isHoldingsLoading || !Number.isFinite(totalPortfolioValue)) {
      return null
    }

    const totalEth = Number.isFinite(ethPrice) && ethPrice > 0 ? totalPortfolioValue / ethPrice : null
    const date = new Date().toISOString().slice(0, 10)
    const vaultValues = sortedHoldings
      .map((vault) => ({
        key: getVaultKey(vault),
        chainId: getVaultChainID(vault),
        vaultAddress: toAddress(getVaultAddress(vault)),
        usdValue: getVaultValue(vault)
      }))
      .filter((vault) => Number.isFinite(vault.usdValue))

    return {
      date,
      totalUsd: totalPortfolioValue,
      totalEth,
      vaults: vaultValues
    }
  }, [ethPrice, getVaultValue, isHoldingsLoading, sortedHoldings, totalPortfolioValue])

  const blendedMetrics = useMemo(() => {
    const isFiniteNumber = (v: number | null): v is number => v !== null && Number.isFinite(v)

    const { totalValue, weightedCurrent, weightedHistorical, hasCurrent, hasHistorical } = sortedHoldings.reduce(
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
  }, [getVaultEstimatedAPY, getVaultHistoricalAPY, getVaultValue, sortedHoldings, totalPortfolioValue])

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
    liveBalanceSnapshot,
    totalPortfolioValue,
    vaultFlags,
    setSortBy,
    setSortDirection
  }
}
