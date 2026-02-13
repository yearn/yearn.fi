import { useExternalSuggestions } from '@pages/portfolio/hooks/useExternalSuggestions'
import { usePersonalizedSuggestions } from '@pages/portfolio/hooks/usePersonalizedSuggestions'
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
import { deriveListKind, isAllocatorVaultOverride } from '@pages/vaults/utils/vaultListFacets'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useMemo, useState } from 'react'

type THoldingsRow = {
  key: string
  vault: TKongVault
  hrefOverride?: string
}

export type TSuggestedItem =
  | { type: 'personalized'; key: string; vault: TKongVault; matchedSymbol: string }
  | {
      type: 'external'
      key: string
      vault: TKongVault
      externalProtocol: string
      externalApy: number
      yearnApy: number
      underlyingSymbol: string
    }
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

  const vaultLookup = useMemo(
    () =>
      new Map(
        Object.values(vaults).flatMap((vault) => {
          const entries: [string, TKongVault][] = [[getVaultKey(vault), vault]]
          const staking = getVaultStaking(vault)
          if (staking?.available && staking.address) {
            entries.push([getChainAddressKey(getVaultChainID(vault), staking.address), vault])
          }
          return entries
        })
      ),
    [vaults]
  )

  const holdingsVaults = useMemo(() => {
    const allMatched = Object.entries(balances || {}).flatMap(([chainIDKey, perChain]) => {
      const parsedChainID = Number(chainIDKey)
      const chainID = Number.isFinite(parsedChainID) ? parsedChainID : undefined
      return Object.values(perChain || {})
        .filter((token) => token?.balance && token.balance.raw > 0n)
        .flatMap((token) => {
          const vault = vaultLookup.get(getChainAddressKey(chainID ?? token.chainID, token.address))
          return vault ? [vault] : []
        })
    })

    const seen = new Set<string>()
    return allMatched.filter((vault) => {
      const key = getVaultKey(vault)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [balances, vaultLookup])

  const vaultFlags = useMemo(
    () =>
      Object.fromEntries(
        holdingsVaults.map((vault) => {
          const info = getVaultInfo(vault)
          const migration = getVaultMigration(vault)
          return [
            getVaultKey(vault),
            {
              hasHoldings: true,
              isMigratable: Boolean(migration?.available),
              isRetired: Boolean(info?.isRetired),
              isHidden: Boolean(info?.isHidden)
            }
          ]
        })
      ) as Record<string, TVaultFlags>,
    [holdingsVaults]
  )

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

  const genericVaults = useMemo(
    () => sortedCandidates.filter((vault) => !holdingsKeySet.has(getVaultKey(vault))).slice(0, 4),
    [sortedCandidates, holdingsKeySet]
  )

  const personalizedSuggestions = usePersonalizedSuggestions(holdingsKeySet)
  const { suggestions: externalSuggestions } = useExternalSuggestions(holdingsKeySet)

  const holdingsRows = useMemo(() => {
    return sortedHoldings.map((vault) => {
      const key = getVaultKey(vault)
      const hrefOverride = isPortfolioV3Vault(vault)
        ? undefined
        : `/vaults/${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`
      return { key, vault, hrefOverride }
    })
  }, [sortedHoldings])

  const suggestedRows = useMemo((): TSuggestedItem[] => {
    type TCandidate = { item: TSuggestedItem; cost: number; vaultKey: string }

    const externalCandidates: TCandidate[] = externalSuggestions.map((ext) => {
      const vaultKey = getVaultKey(ext.vault)
      return {
        item: {
          type: 'external' as const,
          key: `ext-${vaultKey}`,
          vault: ext.vault,
          externalProtocol: ext.externalProtocol,
          externalApy: ext.externalApy,
          yearnApy: ext.yearnApy,
          underlyingSymbol: ext.underlyingSymbol
        },
        cost: 2,
        vaultKey
      }
    })

    const personalizedCandidates: TCandidate[] = personalizedSuggestions.map((ps) => {
      const vaultKey = getVaultKey(ps.vault)
      return {
        item: {
          type: 'personalized' as const,
          key: `pers-${vaultKey}`,
          vault: ps.vault,
          matchedSymbol: ps.matchedSymbol
        },
        cost: 1,
        vaultKey
      }
    })

    const genericCandidates: TCandidate[] = genericVaults.map((vault) => {
      const vaultKey = getVaultKey(vault)
      return {
        item: { type: 'generic' as const, key: `gen-${vaultKey}`, vault },
        cost: 1,
        vaultKey
      }
    })

    return [...externalCandidates, ...personalizedCandidates, ...genericCandidates].reduce<{
      items: TSuggestedItem[]
      budget: number
      usedKeys: Set<string>
    }>(
      (acc, { item, cost, vaultKey }) => {
        if (acc.budget < cost || acc.usedKeys.has(vaultKey)) return acc
        acc.usedKeys.add(vaultKey)
        return { items: [...acc.items, item], budget: acc.budget - cost, usedKeys: acc.usedKeys }
      },
      { items: [], budget: 4, usedKeys: new Set() }
    ).items
  }, [externalSuggestions, personalizedSuggestions, genericVaults])

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

        const stakingValue =
          staking?.available && staking.address
            ? getBalance({
                address: staking.address,
                chainID
              }).normalized * price.normalized
            : 0

        return baseValue + stakingValue
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
