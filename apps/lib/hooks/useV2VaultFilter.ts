import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { toAddress } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults/contexts/useAppSettings'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveProtocol,
  isAllocatorVaultOverride
} from '@vaults/shared/utils/vaultListFacets'
import { getNativeTokenWrapperContract } from '@vaults/utils/nativeTokens'
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
  search?: string,
  categories?: string[] | null,
  protocols?: string[] | null
): TOptimizedV2VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()

  const checkHasHoldings = useCallback(
    (vault: TYDaemonVault): boolean => {
      const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
      const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

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

    Object.values(vaults).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
      if (vault.version?.startsWith('3') || vault.version?.startsWith('~3')) {
        return
      }

      upsertVault(vault)
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
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

    Object.values(vaultsRetired).forEach((vault) => {
      if (isAllocatorVaultOverride(vault)) {
        return
      }
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

  const filteredResults = useMemo(() => {
    const computeFiltered = (searchValue?: string) => {
      const filteredVaults: TYDaemonVault[] = []
      const vaultFlags: Record<string, TVaultFlags> = {}

      processedVaults.forEach(({ vault, hasHoldings, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
        if (searchValue) {
          const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

          try {
            const escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const searchRegex = new RegExp(escapedSearch, 'i')
            if (!searchRegex.test(searchableText)) {
              return
            }
          } catch {
            const lowercaseSearch = searchValue.toLowerCase()
            if (!searchableText.toLowerCase().includes(lowercaseSearch)) {
              return
            }
          }
        }

        if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
          return
        }

        const key = `${vault.chainID}_${toAddress(vault.address)}`
        vaultFlags[key] = {
          hasHoldings: Boolean(hasHoldings || isHoldingsVault),
          isMigratable: isMigratableVault,
          isRetired: isRetiredVault
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
