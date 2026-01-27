import { useYearn } from '@shared/contexts/useYearn'
import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'
import useSWR from 'swr'
import {
  YVUSD_BASELINE_VAULT_ADDRESS,
  YVUSD_CHAIN_ID,
  YVUSD_DESCRIPTION,
  YVUSD_LOCK_BONUS_APY,
  YVUSD_LOCK_TVL_MULTIPLIER,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '../utils/yvUsd'

const REST_BASE = (import.meta.env.VITE_KONG_REST_URL || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
const SNAPSHOT_BASE = `${REST_BASE}/snapshot`

type TYvUsdMetrics = {
  apy: number
  tvl: number
}

type TYvUsdVaults = {
  baseVault?: TYDaemonVault
  listVault?: TYDaemonVault
  unlockedVault?: TYDaemonVault
  lockedVault?: TYDaemonVault
  metrics?: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
  isLoading: boolean
}

const fetchSnapshotVault = async (address: string): Promise<TYDaemonVault | null> => {
  try {
    const response = await fetch(`${SNAPSHOT_BASE}/${YVUSD_CHAIN_ID}/${address}`)
    if (!response.ok) {
      return null
    }
    const json = await response.json()
    const parsed = yDaemonVaultSchema.safeParse(json)
    if (!parsed.success) {
      console.warn('[yvUSD] Snapshot schema mismatch', parsed.error)
      return null
    }
    return parsed.data
  } catch (error) {
    console.warn('[yvUSD] Snapshot fetch failed', error)
    return null
  }
}

const getVaultApy = (vault: TYDaemonVault): number => {
  const forward = vault.apr?.forwardAPR?.netAPR ?? 0
  if (forward && Number.isFinite(forward) && forward !== 0) {
    return forward
  }
  return vault.apr?.netAPR ?? 0
}

const getVaultTvl = (vault: TYDaemonVault): number => vault.tvl?.tvl ?? 0

const applyLockedBonus = (vault: TYDaemonVault): TYDaemonVault => {
  const nextForward = (vault.apr?.forwardAPR?.netAPR ?? 0) + YVUSD_LOCK_BONUS_APY
  const nextNet = (vault.apr?.netAPR ?? 0) + YVUSD_LOCK_BONUS_APY
  const nextPoints = {
    ...vault.apr.points,
    weekAgo: (vault.apr.points?.weekAgo ?? 0) + YVUSD_LOCK_BONUS_APY,
    monthAgo: (vault.apr.points?.monthAgo ?? 0) + YVUSD_LOCK_BONUS_APY
  }

  return {
    ...vault,
    address: YVUSD_LOCKED_ADDRESS,
    chainID: YVUSD_CHAIN_ID,
    name: `${vault.name} (Locked)`,
    apr: {
      ...vault.apr,
      netAPR: nextNet,
      points: nextPoints,
      forwardAPR: {
        ...vault.apr.forwardAPR,
        netAPR: nextForward
      }
    },
    tvl: {
      ...vault.tvl,
      tvl: (vault.tvl?.tvl ?? 0) * YVUSD_LOCK_TVL_MULTIPLIER
    }
  }
}

const buildListVault = (baseVault: TYDaemonVault, unlocked: TYDaemonVault, locked: TYDaemonVault): TYDaemonVault => {
  const combinedTvl = (unlocked.tvl?.tvl ?? 0) + (locked.tvl?.tvl ?? 0)
  return {
    ...baseVault,
    address: YVUSD_UNLOCKED_ADDRESS,
    chainID: YVUSD_CHAIN_ID,
    name: 'yvUSD',
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin',
    tvl: {
      ...baseVault.tvl,
      tvl: combinedTvl
    },
    apr: {
      ...baseVault.apr,
      netAPR: unlocked.apr?.netAPR ?? baseVault.apr?.netAPR ?? 0,
      forwardAPR: {
        ...baseVault.apr.forwardAPR,
        netAPR: unlocked.apr?.forwardAPR?.netAPR ?? baseVault.apr?.forwardAPR?.netAPR ?? 0
      }
    },
    info: {
      ...baseVault.info,
      isHighlighted: true,
      uiNotice: YVUSD_DESCRIPTION
    },
    featuringScore: Math.max(baseVault.featuringScore ?? 0, 9_999)
  }
}

export function useYvUsdVaults(): TYvUsdVaults {
  const { vaults, isLoadingVaultList } = useYearn()

  const baseVault = useMemo(() => vaults[toAddress(YVUSD_BASELINE_VAULT_ADDRESS)], [vaults])

  const { data: unlockedSnapshot, isLoading: isLoadingUnlocked } = useSWR(
    baseVault ? ['yvusd-snapshot', YVUSD_UNLOCKED_ADDRESS] : null,
    () => fetchSnapshotVault(YVUSD_UNLOCKED_ADDRESS)
  )

  const { data: lockedSnapshot, isLoading: isLoadingLocked } = useSWR(
    baseVault ? ['yvusd-snapshot', YVUSD_LOCKED_ADDRESS] : null,
    () => fetchSnapshotVault(YVUSD_LOCKED_ADDRESS)
  )

  const unlockedVault = useMemo(() => {
    if (!baseVault) return undefined
    const snapshot = unlockedSnapshot ?? null
    const merged = snapshot
      ? {
          ...baseVault,
          ...snapshot,
          address: YVUSD_UNLOCKED_ADDRESS,
          chainID: YVUSD_CHAIN_ID,
          name: 'yvUSD',
          symbol: 'yvUSD'
        }
      : {
          ...baseVault,
          address: YVUSD_UNLOCKED_ADDRESS,
          chainID: YVUSD_CHAIN_ID,
          name: 'yvUSD',
          symbol: 'yvUSD'
        }
    return merged
  }, [baseVault, unlockedSnapshot])

  const lockedVault = useMemo(() => {
    if (!baseVault || !unlockedVault) return undefined
    if (lockedSnapshot) {
      return {
        ...baseVault,
        ...lockedSnapshot,
        address: YVUSD_LOCKED_ADDRESS,
        chainID: YVUSD_CHAIN_ID,
        name: 'yvUSD (Locked)',
        symbol: 'yvUSD'
      }
    }
    return applyLockedBonus(unlockedVault)
  }, [baseVault, lockedSnapshot, unlockedVault])

  const listVault = useMemo(() => {
    if (!baseVault || !unlockedVault || !lockedVault) return undefined
    return buildListVault(baseVault, unlockedVault, lockedVault)
  }, [baseVault, unlockedVault, lockedVault])

  const metrics = useMemo(() => {
    if (!unlockedVault || !lockedVault) return undefined
    return {
      unlocked: {
        apy: getVaultApy(unlockedVault),
        tvl: getVaultTvl(unlockedVault)
      },
      locked: {
        apy: getVaultApy(lockedVault),
        tvl: getVaultTvl(lockedVault)
      }
    }
  }, [unlockedVault, lockedVault])

  return {
    baseVault,
    listVault,
    unlockedVault,
    lockedVault,
    metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked || isLoadingLocked
  }
}
