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
  search?: string,
  categories?: string[] | null,
  protocols?: string[] | null
): TOptimizedV2VaultFilterResult {
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

    const upsertVault = (vault: TYDaemonVault, updates: Partial<Omit<TVaultWithMetadata, 'vault'>> = {}): void => {
      const key = getVaultKey(vault)
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

    Object.values(vaults).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
        return
      }

      upsertVault(vault)
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
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

    Object.values(vaultsRetired).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (isV3Vault(vault, false)) {
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

  const holdingsVaults = useMemo(() => extractHoldingsVaults(processedVaults), [processedVaults])

  const availableVaults = useMemo(() => extractAvailableVaults(processedVaults), [processedVaults])

  const filteredResults = useMemo(() => {
    const computeFiltered = (searchValue?: string) => {
      const filteredVaults: TYDaemonVault[] = []
      const vaultFlags: Record<string, TVaultFlags> = {}

      processedVaults.forEach(({ vault, hasHoldings, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
        if (searchValue && !matchesSearch(vault, searchValue)) {
          return
        }

        if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
          return
        }

        const key = `${vault.chainID}_${toAddress(vault.address)}`
        vaultFlags[key] = {
          hasHoldings: Boolean(hasHoldings || isHoldingsVault),
          isMigratable: isMigratableVault,
          isRetired: isRetiredVault,
          isHidden: Boolean(vault.info?.isHidden)
        }

        const kind = deriveListKind(vault)
        const assetCategory = deriveAssetCategory(vault)
        const protocol = deriveProtocol(vault, kind)

        const matchesKind = !types || types.length === 0 || types.includes(kind)
        const matchesCategory = !categories || categories.length === 0 || categories.includes(assetCategory)
        const matchesProtocol =
          !protocols ||
          protocols.length === 0 ||
          Boolean(protocol && protocol !== 'Unknown' && protocols.includes(protocol))

        if (!(matchesKind && matchesCategory && matchesProtocol)) {
          return
        }

        filteredVaults.push(vault)
      })

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
  }, [processedVaults, types, chains, search, categories, protocols])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isLoadingVaultList
  }
}
