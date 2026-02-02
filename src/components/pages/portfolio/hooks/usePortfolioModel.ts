import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { deriveListKind, isAllocatorVaultOverride } from '@pages/vaults/utils/vaultListFacets'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { useMemo, useState } from 'react'

type THoldingsRow = {
  key: string
  vault: TYDaemonVault
  hrefOverride?: string
}

type TSuggestedVaultRow = {
  key: string
  vault: TYDaemonVault
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

function isPortfolioV3Vault(vault: TYDaemonVault): boolean {
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
    const map = new Map<string, TYDaemonVault>()

    Object.values(vaults).forEach((vault) => {
      const vaultKey = getVaultKey(vault)
      map.set(vaultKey, vault)

      if (vault.staking?.available && vault.staking.address) {
        const stakingKey = getChainAddressKey(vault.chainID, vault.staking.address)
        map.set(stakingKey, vault)
      }
    })

    return map
  }, [vaults])

  const holdingsVaults = useMemo(() => {
    const result: TYDaemonVault[] = []
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
      flags[key] = {
        hasHoldings: true,
        isMigratable: Boolean(vault.migration?.available),
        isRetired: Boolean(vault.info?.isRetired),
        isHidden: Boolean(vault.info?.isHidden)
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
        if (vault.chainID !== KATANA_CHAIN_ID || deriveListKind(vault) !== 'allocator') {
          return false
        }

        const isHidden = Boolean(vault.info?.isHidden)
        const isRetired = Boolean(vault.info?.isRetired)
        const isMigratable = Boolean(vault.migration?.available)
        const isHighlighted = Boolean(vault.info?.isHighlighted)

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
        : `/vaults/${vault.chainID}/${toAddress(vault.address)}`
      return { key, vault, hrefOverride }
    })
  }, [sortedHoldings])

  const suggestedRows = useMemo(
    () => suggestedVaults.map((vault) => ({ key: getVaultKey(vault), vault })),
    [suggestedVaults]
  )

  const hasHoldings = sortedHoldings.length > 0
  const hasKatanaHoldings = useMemo(
    () => holdingsVaults.some((vault) => vault.chainID === KATANA_CHAIN_ID),
    [holdingsVaults]
  )
  const totalPortfolioValue = (cumulatedValueInV2Vaults || 0) + (cumulatedValueInV3Vaults || 0)

  const getVaultEstimatedAPY = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number | null => {
        const apy = calculateVaultEstimatedAPY(vault, katanaAprs)
        return apy === 0 && !vault.apr?.netAPR ? null : apy
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
        const shareBalance = getBalance({
          address: vault.address,
          chainID: vault.chainID
        })
        const price = getPrice({
          address: vault.address,
          chainID: vault.chainID
        })
        const baseValue = shareBalance.normalized * price.normalized

        const stakingValue =
          vault.staking?.available && vault.staking.address
            ? getBalance({
                address: vault.staking.address,
                chainID: vault.chainID
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
