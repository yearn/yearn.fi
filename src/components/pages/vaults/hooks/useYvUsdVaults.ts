import { getVaultView, type TKongVaultInput, type TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { useYearn } from '@shared/contexts/useYearn'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'
import { useVaultSnapshot } from './useVaultSnapshot'
import { useYvUsdPoints } from './useYvUsdPoints'
import { buildSyntheticBaseVault, buildYvUsdVaultsModel, type TYvUsdMetrics } from './useYvUsdVaults.helpers'

type TYvUsdVaults = {
  assetAddress: `0x${string}`
  baseVault: TKongVaultView
  listVault: TKongVaultView
  unlockedVault: TKongVaultView
  lockedVault: TKongVaultView
  metrics: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
  isLoading: boolean
}

export function useYvUsdVaults(): TYvUsdVaults {
  const { vaults, isLoadingVaultList } = useYearn()
  const points = useYvUsdPoints()

  const { data: unlockedSnapshot, isLoading: isLoadingUnlocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_UNLOCKED_ADDRESS
  })

  const { data: lockedSnapshot, isLoading: isLoadingLocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS
  })

  const baseVault = useMemo<TKongVaultInput>(() => {
    const baseCandidates = [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS]
    const listVaultCandidate = baseCandidates.map((address) => vaults[toAddress(address)]).find(Boolean)
    if (listVaultCandidate) {
      return listVaultCandidate
    }

    return buildSyntheticBaseVault(unlockedSnapshot ?? lockedSnapshot)
  }, [lockedSnapshot, unlockedSnapshot, vaults])

  const baseVaultView = useMemo((): TKongVaultView => getVaultView(baseVault), [baseVault])

  const model = useMemo(
    () =>
      buildYvUsdVaultsModel({
        baseVault,
        unlockedSnapshot,
        lockedSnapshot,
        points: {
          unlocked: points.unlocked,
          locked: points.locked
        }
      }),
    [baseVault, lockedSnapshot, points.locked, points.unlocked, unlockedSnapshot]
  )

  return {
    assetAddress: model.assetAddress,
    baseVault: baseVaultView,
    listVault: model.listVault,
    unlockedVault: model.unlockedVault,
    lockedVault: model.lockedVault,
    metrics: model.metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked || isLoadingLocked || points.isLoading
  }
}
