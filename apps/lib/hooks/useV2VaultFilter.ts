import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { isAutomatedVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults-v2/contexts/useAppSettings'
import { useCallback, useMemo } from 'react'

type TVaultWithMetadata = {
  vault: TYDaemonVault
  hasHoldings: boolean
}

type TOptimizedV2VaultFilterResult = {
  // Main filtered results
  activeVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]

  // Utility data
  isLoading: boolean
}

export function useV2VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string
): TOptimizedV2VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()

  // Check if a vault has holdings
  const checkHasHoldings = useCallback(
    (vault: TYDaemonVault): boolean => {
      const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
      const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

      // Check staking balance
      if (vault.staking.available) {
        const stakingBalance = getBalance({
          address: vault.staking.address,
          chainID: vault.chainID
        })
        const hasValidStakedBalance = stakingBalance.raw > 0n
        const stakedBalanceValue = Number(stakingBalance.normalized) * vaultPrice.normalized
        if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
          return true
        }
      }

      // Check regular balance
      const hasValidBalance = vaultBalance.raw > 0n
      const balanceValue = Number(vaultBalance.normalized) * vaultPrice.normalized

      return hasValidBalance && !(shouldHideDust && balanceValue < 0.01)
    },
    [getBalance, getPrice, shouldHideDust]
  )

  // Main processing function - single pass through all vaults
  const processedVaults = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultWithMetadata>()

    // Process main vaults
    Object.values({ ...vaults, ...vaultsMigrations, ...vaultsRetired }).forEach((vault) => {
      // Only v2 vaults (exclude v3)
      if (vault.version?.startsWith('3') || vault.version?.startsWith('~3')) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      const key = `${vault.chainID}_${toAddress(vault.address)}`

      vaultMap.set(key, {
        vault,
        hasHoldings
      })
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired, checkHasHoldings])

  // Apply filters and categorize
  const filteredResults = useMemo(() => {
    const results = {
      activeVaults: [] as TYDaemonVault[],
      holdingsVaults: [] as TYDaemonVault[],
      migratableVaults: [] as TYDaemonVault[]
    }

    // Pre-categorize vaults for type filtering
    const categorizedVaults = {
      highlighted: [] as TYDaemonVault[],
      curveFactory: [] as TYDaemonVault[],
      curve: [] as TYDaemonVault[],
      prisma: [] as TYDaemonVault[],
      balancer: [] as TYDaemonVault[],
      velodrome: [] as TYDaemonVault[],
      aerodrome: [] as TYDaemonVault[],
      boosted: [] as TYDaemonVault[],
      stables: [] as TYDaemonVault[],
      crypto: [] as TYDaemonVault[],
      holdings: [] as TYDaemonVault[],
      all: [] as TYDaemonVault[]
    }

    processedVaults.forEach(({ vault, hasHoldings }) => {
      // Apply search filter
      if (search) {
        const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

        try {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const searchRegex = new RegExp(escapedSearch, 'i')
          if (!searchRegex.test(searchableText)) {
            return
          }
        } catch {
          // Fallback to simple string matching if regex fails
          const lowercaseSearch = search.toLowerCase()
          if (!searchableText.toLowerCase().includes(lowercaseSearch)) {
            return
          }
        }
      }

      // Chain filter
      if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
        return
      }

      categorizedVaults.all.push(vault)

      if (vault.info?.isHighlighted) {
        categorizedVaults.highlighted.push(vault)
      }
      if (vault.category === 'Curve' && isAutomatedVault(vault)) {
        categorizedVaults.curveFactory.push(vault)
      }
      if (vault.category === 'Curve') {
        categorizedVaults.curve.push(vault)
      }
      if (vault.category === 'Prisma') {
        categorizedVaults.prisma.push(vault)
      }
      if (vault.category === 'Balancer') {
        categorizedVaults.balancer.push(vault)
      }
      if (vault.category === 'Velodrome') {
        categorizedVaults.velodrome.push(vault)
      }
      if (vault.category === 'Aerodrome') {
        categorizedVaults.aerodrome.push(vault)
      }
      if (vault.apr.extra.stakingRewardsAPR > 0) {
        categorizedVaults.boosted.push(vault)
      }
      if (vault.category === 'Stablecoin') {
        categorizedVaults.stables.push(vault)
      }
      if (vault.category === 'Volatile') {
        categorizedVaults.crypto.push(vault)
      }
      if (hasHoldings) {
        categorizedVaults.holdings.push(vault)
      }

      // Add to holdings if applicable
      if (hasHoldings) {
        results.holdingsVaults.push(vault)
      }
    })

    // Build active vaults based on selected types
    const seenVaults = new Set<string>()

    if (!types || types.length === 0) {
      // If no types selected, return all active vaults
      results.activeVaults = categorizedVaults.all
    } else {
      // Featured logic - special case
      if (types.includes('featured')) {
        const featured = [...categorizedVaults.all]
          .sort((a, b) => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0))
          .slice(0, 10)

        featured.forEach((vault) => {
          const key = `${vault.chainID}_${toAddress(vault.address)}`
          if (!seenVaults.has(key)) {
            results.activeVaults.push(vault)
            seenVaults.add(key)
          }
        })
      }

      // Add vaults from selected categories
      const categoryMap: Record<string, TYDaemonVault[]> = {
        curveF: categorizedVaults.curveFactory,
        curve: categorizedVaults.curve,
        prisma: categorizedVaults.prisma,
        balancer: categorizedVaults.balancer,
        velodrome: categorizedVaults.velodrome,
        aerodrome: categorizedVaults.aerodrome,
        boosted: categorizedVaults.boosted,
        stables: categorizedVaults.stables,
        crypto: categorizedVaults.crypto,
        holdings: categorizedVaults.holdings
      }

      types.forEach((type) => {
        const vaultsForType = categoryMap[type] || []
        vaultsForType.forEach((vault) => {
          const key = `${vault.chainID}_${toAddress(vault.address)}`
          if (!seenVaults.has(key)) {
            results.activeVaults.push(vault)
            seenVaults.add(key)
          }
        })
      })
    }

    return results
  }, [processedVaults, types, chains, search])

  return {
    ...filteredResults,
    isLoading: isLoadingVaultList
  }
}
