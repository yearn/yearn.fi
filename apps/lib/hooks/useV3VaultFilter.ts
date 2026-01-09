import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults/contexts/useAppSettings'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveProtocol,
  deriveV3Aggressiveness,
  isAllocatorVaultOverride
} from '@vaults/shared/utils/vaultListFacets'
import { useMemo } from 'react'
import {
  createCheckHasAvailableBalance,
  createCheckHasHoldings,
  extractAvailableVaults,
  extractHoldingsVaults,
  getVaultKey,
  isV3Vault,
  matchesSearch,
  type TVaultFlags,
  type TVaultWithMetadata
} from './useVaultFilterUtils'

type TV3VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  totalMatchingVaults: number
  totalHoldingsMatching: number
  totalAvailableMatching: number
  totalMigratableMatching: number
  totalRetiredMatching: number
  isLoading: boolean
}

export function useV3VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  protocols?: string[] | null,
  aggressiveness?: number[] | null,
  showHiddenVaults?: boolean
): TV3VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()

  const checkHasHoldings = useMemo(
    () => createCheckHasHoldings(getBalance, getPrice, shouldHideDust),
    [getBalance, getPrice, shouldHideDust]
  )

  const checkHasAvailableBalance = useMemo(() => createCheckHasAvailableBalance(getBalance), [getBalance])

  const processedVaults = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultWithMetadata>()

    Object.values(vaults).forEach((vault) => {
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      const hasAvailableBalance = checkHasAvailableBalance(vault)
      const key = getVaultKey(vault)

      vaultMap.set(key, {
        vault,
        hasHoldings,
        hasAvailableBalance,
        isHoldingsVault: hasHoldings,
        isMigratableVault: false,
        isRetiredVault: false
      })
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      if (!hasHoldings) return
      const hasAvailableBalance = checkHasAvailableBalance(vault)

      const key = getVaultKey(vault)

      const existing = vaultMap.get(key)
      if (existing) {
        existing.isMigratableVault = true
        existing.hasHoldings = true
        existing.isHoldingsVault = true
        existing.hasAvailableBalance = existing.hasAvailableBalance || hasAvailableBalance
      } else {
        vaultMap.set(key, {
          vault,
          hasHoldings: true,
          hasAvailableBalance,
          isHoldingsVault: false,
          isMigratableVault: true,
          isRetiredVault: false
        })
      }
    })

    Object.values(vaultsRetired).forEach((vault) => {
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      if (!hasHoldings) return
      const hasAvailableBalance = checkHasAvailableBalance(vault)
      const key = getVaultKey(vault)

      const existing = vaultMap.get(key)
      if (existing) {
        existing.isRetiredVault = true
        existing.hasHoldings = true
        existing.isHoldingsVault = false
        existing.hasAvailableBalance = existing.hasAvailableBalance || hasAvailableBalance
      } else {
        vaultMap.set(key, {
          vault,
          hasHoldings: true,
          hasAvailableBalance,
          isHoldingsVault: false,
          isMigratableVault: false,
          isRetiredVault: true
        })
      }
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired, checkHasHoldings, checkHasAvailableBalance])

  const holdingsVaults = useMemo(() => extractHoldingsVaults(processedVaults), [processedVaults])

  const availableVaults = useMemo(() => extractAvailableVaults(processedVaults), [processedVaults])

  const filteredResults = useMemo(() => {
    const filteredVaults: TYDaemonVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}

    let totalMatchingVaults = 0
    let totalHoldingsMatching = 0
    let totalAvailableMatching = 0
    let totalMigratableMatching = 0
    let totalRetiredMatching = 0

    processedVaults.forEach(
      ({ vault, hasHoldings, hasAvailableBalance, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
        if (search && !matchesSearch(vault, search)) {
          return
        }

        if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
          return
        }

        const key = `${vault.chainID}_${toAddress(vault.address)}`
        const hasUserHoldings = Boolean(hasHoldings || isHoldingsVault)

        vaultFlags[key] = {
          hasHoldings: hasUserHoldings,
          isMigratable: isMigratableVault,
          isRetired: isRetiredVault,
          isHidden: Boolean(vault.info?.isHidden)
        }

        totalMatchingVaults++
        if (hasUserHoldings) {
          totalHoldingsMatching++
        }
        if (hasAvailableBalance) {
          totalAvailableMatching++
        }
        if (isMigratableVault) {
          totalMigratableMatching++
        }
        if (isRetiredVault) {
          totalRetiredMatching++
        }

        const vaultCategorySet = new Set<string>()
        vaultCategorySet.add(deriveAssetCategory(vault))

        const shouldIncludeByCategory =
          !categories || categories.length === 0 || categories.some((category) => vaultCategorySet.has(category))

        const isFeatured = Boolean(vault.info?.isHighlighted)
        const isHidden = Boolean(vault.info?.isHidden)
        const isPinnedByUserContext = Boolean(hasUserHoldings || isMigratableVault || isRetiredVault)
        const kind = deriveListKind(vault)
        const isStrategy = kind === 'strategy'
        const shouldIncludeByFeaturedGate = Boolean(
          showHiddenVaults || (!isHidden && (isStrategy || isFeatured || isPinnedByUserContext))
        )

        let shouldIncludeByKind = true
        if (types && types.length > 0) {
          const hasMulti = types.includes('multi')
          const hasSingle = types.includes('single')

          const matchesAllocator = hasMulti && kind === 'allocator'
          const matchesStrategy = hasSingle && kind === 'strategy'

          shouldIncludeByKind = Boolean(matchesAllocator || matchesStrategy)
        }

        let shouldIncludeByProtocol = true
        if (protocols && protocols.length > 0) {
          if (kind === 'allocator') {
            shouldIncludeByProtocol = false
          } else {
            const protocol = deriveProtocol(vault, kind)
            shouldIncludeByProtocol = Boolean(protocol && protocol !== 'Unknown' && protocols.includes(protocol))
          }
        }

        let shouldIncludeByAggressiveness = true
        if (aggressiveness && aggressiveness.length > 0) {
          const score = deriveV3Aggressiveness(vault)
          shouldIncludeByAggressiveness = Boolean(score !== null && aggressiveness.includes(score))
        }

        if (
          shouldIncludeByCategory &&
          shouldIncludeByFeaturedGate &&
          shouldIncludeByKind &&
          shouldIncludeByProtocol &&
          shouldIncludeByAggressiveness
        ) {
          filteredVaults.push(vault)
        }
      }
    )

    return {
      filteredVaults,
      holdingsVaults,
      vaultFlags,
      totalMatchingVaults,
      totalHoldingsMatching,
      totalAvailableMatching,
      totalMigratableMatching,
      totalRetiredMatching
    }
  }, [processedVaults, types, chains, search, categories, protocols, aggressiveness, holdingsVaults, showHiddenVaults])

  return {
    ...filteredResults,
    availableVaults,
    isLoading: isLoadingVaultList
  }
}
