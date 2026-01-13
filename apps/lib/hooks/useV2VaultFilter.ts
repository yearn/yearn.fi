import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults/contexts/useAppSettings'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveV3Aggressiveness,
  isAllocatorVaultOverride,
  type TVaultAggressiveness
} from '@vaults/shared/utils/vaultListFacets'
import { useMemo } from 'react'
import {
  createCheckHasAvailableBalance,
  createCheckHasHoldings,
  getVaultKey,
  isV3Vault,
  type TVaultFlags
} from './useVaultFilterUtils'

type TVaultIndexEntry = {
  key: string
  vault: TYDaemonVault
  searchableText: string
  kind: ReturnType<typeof deriveListKind>
  category: string
  aggressiveness: TVaultAggressiveness | null
  isHidden: boolean
  isActive: boolean
  isMigratable: boolean
  isRetired: boolean
}

type TVaultWalletFlags = {
  hasHoldings: boolean
  hasAvailableBalance: boolean
}

type TOptimizedV2VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  isLoading: boolean
}

export function useV2VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  aggressiveness?: TVaultAggressiveness[] | null,
  showHiddenVaults?: boolean
): TOptimizedV2VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()
  const searchRegex = useMemo(() => {
    if (!search) {
      return null
    }
    try {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(escapedSearch, 'i')
    } catch {
      return null
    }
  }, [search])
  const lowercaseSearch = useMemo(() => (search ? search.toLowerCase() : ''), [search])

  const checkHasHoldings = useMemo(
    () => createCheckHasHoldings(getBalance, getPrice, shouldHideDust),
    [getBalance, getPrice, shouldHideDust]
  )

  const checkHasAvailableBalance = useMemo(() => createCheckHasAvailableBalance(getBalance), [getBalance])

  const vaultIndex = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultIndexEntry>()

    const upsertVault = (
      vault: TYDaemonVault,
      updates: Partial<Pick<TVaultIndexEntry, 'isActive' | 'isMigratable' | 'isRetired'>>
    ): void => {
      const key = getVaultKey(vault)
      const existing = vaultMap.get(key)
      if (existing) {
        vaultMap.set(key, { ...existing, ...updates })
        return
      }

      const kind = deriveListKind(vault)
      vaultMap.set(key, {
        key,
        vault,
        searchableText:
          `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`.toLowerCase(),
        kind,
        category: deriveAssetCategory(vault),
        aggressiveness: deriveV3Aggressiveness(vault),
        isHidden: Boolean(vault.info?.isHidden),
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired)
      })
    }

    Object.values(vaults).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
        return
      }

      upsertVault(vault, { isActive: true })
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
        return
      }

      upsertVault(vault, { isMigratable: true })
    })

    Object.values(vaultsRetired).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
        return
      }

      upsertVault(vault, { isRetired: true })
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired])

  const walletFlags = useMemo(() => {
    const flags = new Map<string, TVaultWalletFlags>()
    vaultIndex.forEach((entry, key) => {
      flags.set(key, {
        hasHoldings: checkHasHoldings(entry.vault),
        hasAvailableBalance: checkHasAvailableBalance(entry.vault)
      })
    })
    return flags
  }, [vaultIndex, checkHasHoldings, checkHasAvailableBalance])

  const holdingsVaults = useMemo(() => {
    return Array.from(vaultIndex.values())
      .filter(({ key }) => walletFlags.get(key)?.hasHoldings)
      .map(({ vault }) => vault)
  }, [vaultIndex, walletFlags])

  const availableVaults = useMemo(() => {
    return Array.from(vaultIndex.values())
      .filter(({ key, isActive }) => {
        const flags = walletFlags.get(key)
        if (!flags?.hasAvailableBalance) {
          return false
        }
        if (isActive) {
          return true
        }
        return Boolean(flags.hasHoldings)
      })
      .map(({ vault }) => vault)
  }, [vaultIndex, walletFlags])

  const filteredResults = useMemo(() => {
    const filteredVaults: TYDaemonVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}
    const shouldShowHidden = Boolean(showHiddenVaults)

    vaultIndex.forEach((entry) => {
      const {
        key,
        vault,
        searchableText,
        kind,
        category,
        aggressiveness: aggressivenessScore,
        isHidden,
        isActive,
        isMigratable,
        isRetired
      } = entry
      const walletFlag = walletFlags.get(key)
      const hasHoldings = Boolean(walletFlag?.hasHoldings)

      if (!isActive && !hasHoldings) {
        return
      }

      if (search) {
        if (searchRegex) {
          if (!searchRegex.test(searchableText)) {
            return
          }
        } else if (!searchableText.includes(lowercaseSearch)) {
          return
        }
      }

      if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
        return
      }

      const isMigratableVault = Boolean(isMigratable && hasHoldings)
      const isRetiredVault = Boolean(isRetired && hasHoldings)
      const hasUserHoldings = Boolean(hasHoldings || isMigratableVault || isRetiredVault)

      if (!shouldShowHidden && isHidden && !hasUserHoldings) {
        return
      }
      vaultFlags[key] = {
        hasHoldings: hasUserHoldings,
        isMigratable: isMigratableVault,
        isRetired: isRetiredVault,
        isHidden
      }

      const matchesKind = !types || types.length === 0 || types.includes(kind)
      const matchesCategory = !categories || categories.length === 0 || categories.includes(category)
      const matchesAggressiveness =
        !aggressiveness || aggressiveness.length === 0
          ? true
          : Boolean(aggressivenessScore && aggressiveness.includes(aggressivenessScore))

      if (!(matchesKind && matchesCategory && matchesAggressiveness)) {
        return
      }

      filteredVaults.push(vault)
    })

    return { filteredVaults, vaultFlags }
  }, [
    vaultIndex,
    walletFlags,
    types,
    chains,
    search,
    categories,
    aggressiveness,
    searchRegex,
    lowercaseSearch,
    showHiddenVaults
  ])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isLoadingVaultList
  }
}
