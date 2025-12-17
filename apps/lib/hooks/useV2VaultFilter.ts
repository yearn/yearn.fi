import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { toAddress } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { isAutomatedVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults-v2/contexts/useAppSettings'
import { getNativeTokenWrapperContract } from '@vaults-v2/utils'
import { useCallback, useMemo } from 'react'

type TVaultWithMetadata = {
  vault: TYDaemonVault
  hasHoldings: boolean
  hasAvailableBalance: boolean
  isHoldingsVault: boolean
  isMigratableVault: boolean
  isRetiredVault: boolean
}

type TVaultFlags = {
  hasHoldings: boolean
  isMigratable: boolean
  isRetired: boolean
}

type TOptimizedV2VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  filteredVaultsNoSearch: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
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

  const checkHasAvailableBalance = useCallback(
    (vault: TYDaemonVault): boolean => {
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
    },
    [getBalance]
  )

  // Main processing function - single pass through all vaults
  const processedVaults = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultWithMetadata>()

    const upsertVault = (vault: TYDaemonVault, updates: Partial<Omit<TVaultWithMetadata, 'vault'>> = {}): void => {
      const key = `${vault.chainID}_${toAddress(vault.address)}`
      const hasHoldings = checkHasHoldings(vault)
      const hasAvailableBalance = checkHasAvailableBalance(vault)
      const existing = vaultMap.get(key)

      if (existing) {
        vaultMap.set(key, {
          ...existing,
          hasHoldings: existing.hasHoldings || hasHoldings,
          hasAvailableBalance: existing.hasAvailableBalance || hasAvailableBalance,
          isHoldingsVault: existing.isHoldingsVault || hasHoldings,
          ...updates
        })
        return
      }

      vaultMap.set(key, {
        vault,
        hasHoldings,
        hasAvailableBalance,
        isHoldingsVault: hasHoldings,
        isMigratableVault: false,
        isRetiredVault: false,
        ...updates
      })
    }

    // Process main vaults
    Object.values(vaults).forEach((vault) => {
      if (vault.version?.startsWith('3') || vault.version?.startsWith('~3')) {
        return
      }

      upsertVault(vault)
    })

    // Process migratable vaults
    Object.values(vaultsMigrations).forEach((vault) => {
      if (vault.version?.startsWith('3') || vault.version?.startsWith('~3')) {
        return
      }

      if (!checkHasHoldings(vault)) {
        return
      }

      upsertVault(vault, {
        isMigratableVault: true,
        isHoldingsVault: true
      })
    })

    // Process retired vaults
    Object.values(vaultsRetired).forEach((vault) => {
      if (vault.version?.startsWith('3') || vault.version?.startsWith('~3')) {
        return
      }

      if (!checkHasHoldings(vault)) {
        return
      }

      upsertVault(vault, {
        isRetiredVault: true,
        isHoldingsVault: true
      })
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired, checkHasHoldings, checkHasAvailableBalance])

  const holdingsVaults = useMemo(() => {
    return Array.from(processedVaults.values())
      .filter(({ hasHoldings }) => hasHoldings)
      .map(({ vault }) => vault)
  }, [processedVaults])

  const availableVaults = useMemo(() => {
    return Array.from(processedVaults.values())
      .filter(({ hasAvailableBalance }) => hasAvailableBalance)
      .map(({ vault }) => vault)
  }, [processedVaults])

  // Apply filters and categorize
  const filteredResults = useMemo(() => {
    const computeFiltered = (searchValue?: string) => {
      const vaultFlags: Record<string, TVaultFlags> = {}

      const holdingsSet = new Set<string>()
      const migratableSet = new Set<string>()
      const retiredSet = new Set<string>()

      const categorySets = {
        all: new Set<string>(),
        highlighted: new Set<string>(),
        curveFactory: new Set<string>(),
        curve: new Set<string>(),
        prisma: new Set<string>(),
        balancer: new Set<string>(),
        velodrome: new Set<string>(),
        aerodrome: new Set<string>(),
        boosted: new Set<string>(),
        stables: new Set<string>(),
        crypto: new Set<string>()
      }

      const addUnique = (set: Set<string>, list: TYDaemonVault[], vault: TYDaemonVault): void => {
        const key = `${vault.chainID}_${toAddress(vault.address)}`
        if (!set.has(key)) {
          set.add(key)
          list.push(vault)
        }
      }

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
        migratable: [] as TYDaemonVault[],
        retired: [] as TYDaemonVault[],
        all: [] as TYDaemonVault[]
      }

      processedVaults.forEach(({ vault, hasHoldings, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
        // Apply search filter
        if (searchValue) {
          const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

          try {
            const escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const searchRegex = new RegExp(escapedSearch, 'i')
            if (!searchRegex.test(searchableText)) {
              return
            }
          } catch {
            // Fallback to simple string matching if regex fails
            const lowercaseSearch = searchValue.toLowerCase()
            if (!searchableText.toLowerCase().includes(lowercaseSearch)) {
              return
            }
          }
        }

        // Chain filter
        if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
          return
        }

        const key = `${vault.chainID}_${toAddress(vault.address)}`
        vaultFlags[key] = {
          hasHoldings: Boolean(hasHoldings || isHoldingsVault),
          isMigratable: isMigratableVault,
          isRetired: isRetiredVault
        }

        if (isMigratableVault) {
          addUnique(migratableSet, categorizedVaults.migratable, vault)
        }
        if (isRetiredVault) {
          addUnique(retiredSet, categorizedVaults.retired, vault)
        }
        if (hasHoldings || isHoldingsVault) {
          addUnique(holdingsSet, categorizedVaults.holdings, vault)
        }

        addUnique(categorySets.all, categorizedVaults.all, vault)

        if (vault.info?.isHighlighted) {
          addUnique(categorySets.highlighted, categorizedVaults.highlighted, vault)
        }
        if (vault.category === 'Curve' && isAutomatedVault(vault)) {
          addUnique(categorySets.curveFactory, categorizedVaults.curveFactory, vault)
        }
        if (vault.category === 'Curve') {
          addUnique(categorySets.curve, categorizedVaults.curve, vault)
        }
        if (vault.category === 'Prisma') {
          addUnique(categorySets.prisma, categorizedVaults.prisma, vault)
        }
        if (vault.category === 'Balancer') {
          addUnique(categorySets.balancer, categorizedVaults.balancer, vault)
        }
        if (vault.category === 'Velodrome') {
          addUnique(categorySets.velodrome, categorizedVaults.velodrome, vault)
        }
        if (vault.category === 'Aerodrome') {
          addUnique(categorySets.aerodrome, categorizedVaults.aerodrome, vault)
        }
        if (vault.apr.extra.stakingRewardsAPR > 0) {
          addUnique(categorySets.boosted, categorizedVaults.boosted, vault)
        }
        if (vault.category === 'Stablecoin') {
          addUnique(categorySets.stables, categorizedVaults.stables, vault)
        }
        if (vault.category === 'Volatile') {
          addUnique(categorySets.crypto, categorizedVaults.crypto, vault)
        }
      })

      const seenVaults = new Set<string>()
      const filteredVaults: TYDaemonVault[] = []

      const appendVaults = (vaults: TYDaemonVault[]): void => {
        vaults.forEach((vault) => {
          const uniqueKey = `${vault.chainID}_${toAddress(vault.address)}`
          if (!seenVaults.has(uniqueKey)) {
            seenVaults.add(uniqueKey)
            filteredVaults.push(vault)
          }
        })
      }

      if (!types || types.length === 0) {
        appendVaults(categorizedVaults.all)
        appendVaults(categorizedVaults.migratable)
        appendVaults(categorizedVaults.retired)
      } else {
        if (types.includes('featured')) {
          const featured = [...categorizedVaults.all]
            .filter((vault) => {
              const flagKey = `${vault.chainID}_${toAddress(vault.address)}`
              const flags = vaultFlags[flagKey]
              return !(flags?.isMigratable || flags?.isRetired)
            })
            .sort((a, b) => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0))
            .slice(0, 10)

          appendVaults(featured)
        }

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
          holdings: categorizedVaults.holdings,
          migratable: categorizedVaults.migratable,
          retired: categorizedVaults.retired
        }

        types.forEach((type) => {
          if (type === 'featured') {
            return
          }
          const vaultsForType = categoryMap[type] || []
          appendVaults(vaultsForType)
        })
      }

      return {
        filteredVaults,
        vaultFlags
      }
    }

    const searched = computeFiltered(search)
    const unsearched = computeFiltered(undefined)

    return {
      filteredVaults: searched.filteredVaults,
      filteredVaultsNoSearch: unsearched.filteredVaults,
      vaultFlags: searched.vaultFlags
    }
  }, [processedVaults, types, chains, search])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isLoadingVaultList
  }
}
