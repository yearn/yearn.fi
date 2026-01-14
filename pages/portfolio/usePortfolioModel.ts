import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { getVaultKey, isV3Vault, type TVaultFlags } from '@lib/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@lib/types'
import { isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { calculateVaultEstimatedAPY } from '@lib/utils/vaultApy'
import { type TPossibleSortBy, useSortVaults } from '@vaults/shared/index'
import { isAllocatorVaultOverride } from '@vaults/shared/utils/vaultListFacets'
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
  const { getPrice, katanaAprs, vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList } = useYearn()
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('deposited')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  const vaultLookup = useMemo(() => {
    const map = new Map<string, TYDaemonVault>()
    const allVaults = {
      ...vaults,
      ...vaultsMigrations,
      ...vaultsRetired
    }

    Object.values(allVaults).forEach((vault) => {
      const vaultKey = getVaultKey(vault)
      map.set(vaultKey, vault)

      if (vault.staking?.available && vault.staking.address) {
        const stakingKey = getChainAddressKey(vault.chainID, vault.staking.address)
        map.set(stakingKey, vault)
      }
    })

    return map
  }, [vaults, vaultsMigrations, vaultsRetired])

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

  const migratableSet = useMemo(
    () => new Set(Object.values(vaultsMigrations).map((vault) => getVaultKey(vault))),
    [vaultsMigrations]
  )
  const retiredSet = useMemo(
    () => new Set(Object.values(vaultsRetired).map((vault) => getVaultKey(vault))),
    [vaultsRetired]
  )

  const vaultFlags = useMemo(() => {
    const flags: Record<string, TVaultFlags> = {}

    holdingsVaults.forEach((vault) => {
      const key = getVaultKey(vault)
      flags[key] = {
        hasHoldings: true,
        isMigratable: migratableSet.has(key),
        isRetired: retiredSet.has(key),
        isHidden: Boolean(vault.info?.isHidden)
      }
    })

    return flags
  }, [holdingsVaults, migratableSet, retiredSet])

  const isSearchingBalances =
    (isActive || isUserConnecting) && (isWalletLoading || isUserConnecting || isIdentityLoading)
  const isLoading = isLoadingVaultList
  const isHoldingsLoading = (isLoading && isActive) || isSearchingBalances

  const v3Vaults = useMemo(() => Object.values(vaults).filter((vault) => isPortfolioV3Vault(vault)), [vaults])

  const sortedHoldings = useSortVaults(holdingsVaults, sortBy, sortDirection)
  const sortedCandidates = useSortVaults(v3Vaults, 'featuringScore', 'desc')

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
        const monthlyAPY = vault.apr?.points?.monthAgo
        const weeklyAPY = vault.apr?.points?.weekAgo
        const chosenAPY = !isZero(monthlyAPY || 0) ? monthlyAPY : weeklyAPY
        return typeof chosenAPY === 'number' ? chosenAPY : null
      },
    []
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

        let stakingValue = 0
        if (vault.staking?.available && vault.staking.address) {
          const stakingBalance = getBalance({
            address: vault.staking.address,
            chainID: vault.chainID
          })
          stakingValue = stakingBalance.normalized * price.normalized
        }

        return baseValue + stakingValue
      },
    [getBalance, getPrice]
  )

  const blendedMetrics = useMemo(() => {
    let totalValue = 0
    let weightedCurrent = 0
    let weightedHistorical = 0
    let hasCurrent = false
    let hasHistorical = false

    holdingsVaults.forEach((vault) => {
      const value = getVaultValue(vault)
      if (!Number.isFinite(value) || value <= 0) {
        return
      }

      const estimatedAPY = getVaultEstimatedAPY(vault)
      if (typeof estimatedAPY === 'number' && Number.isFinite(estimatedAPY)) {
        weightedCurrent += value * estimatedAPY
        hasCurrent = true
      }

      const historicalAPY = getVaultHistoricalAPY(vault)
      if (typeof historicalAPY === 'number' && Number.isFinite(historicalAPY)) {
        weightedHistorical += value * historicalAPY
        hasHistorical = true
      }

      totalValue += value
    })

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
