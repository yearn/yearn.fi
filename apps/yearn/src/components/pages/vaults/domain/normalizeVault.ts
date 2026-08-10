import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/yBoldProduct'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { type Address, zeroAddress } from 'viem'

export {
  isYBoldProductAddress,
  isYBoldVaultAddress,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from '@pages/vaults/domain/yBoldProduct'

const HOLDINGS_ALIAS_BY_ADDRESS: Record<string, Address> = {
  [toAddress(YBOLD_STAKING_ADDRESS)]: YBOLD_VAULT_ADDRESS
}

export function mergeYBoldVault(baseVault: TKongVaultListItem, stakedVault: TKongVaultListItem): TKongVaultListItem {
  return {
    ...baseVault,
    staking: {
      address: YBOLD_STAKING_ADDRESS,
      available: true,
      source: 'yBOLD',
      rewards: stakedVault.staking?.rewards ?? baseVault.staking?.rewards ?? []
    },
    performance: {
      ...(baseVault.performance ?? {}),
      historical: stakedVault.performance?.historical ?? null,
      estimated: stakedVault.performance?.estimated ?? null,
      oracle: stakedVault.performance?.oracle ?? null
    },
    fees: {
      managementFee: baseVault.fees?.managementFee ?? 0,
      performanceFee: stakedVault.fees?.performanceFee ?? baseVault.fees?.performanceFee ?? 0
    }
  }
}

export function stripYBoldBaseMetrics(baseSnapshot: TKongVaultSnapshot): TKongVaultSnapshot {
  return {
    ...baseSnapshot,
    apy: baseSnapshot.apy
      ? {
          ...baseSnapshot.apy,
          net: null,
          grossApr: null,
          weeklyNet: null,
          monthlyNet: null,
          inceptionNet: null,
          pricePerShare: null,
          weeklyPricePerShare: null,
          monthlyPricePerShare: null
        }
      : baseSnapshot.apy,
    fees: baseSnapshot.fees
      ? {
          ...baseSnapshot.fees,
          performanceFee: null
        }
      : baseSnapshot.fees,
    performance: {
      ...baseSnapshot.performance,
      historical: undefined,
      oracle: undefined,
      estimated: undefined
    }
  }
}

export function mergeYBoldSnapshot(
  baseSnapshot: TKongVaultSnapshot,
  stakedSnapshot: TKongVaultSnapshot
): TKongVaultSnapshot {
  const baseSnapshotWithoutStakedMetrics = stripYBoldBaseMetrics(baseSnapshot)

  return {
    ...baseSnapshotWithoutStakedMetrics,
    staking: {
      ...(baseSnapshot.staking ?? {}),
      address: YBOLD_STAKING_ADDRESS,
      available: true,
      source: 'yBOLD',
      rewards:
        baseSnapshot.staking?.rewards && baseSnapshot.staking.rewards.length > 0
          ? baseSnapshot.staking.rewards
          : [
              {
                address: zeroAddress,
                name: 'null',
                symbol: 'null',
                decimals: 18,
                price: 0,
                isFinished: false,
                finishedAt: 9748476800,
                apr: null,
                perWeek: 0
              }
            ]
    },
    apy: {
      ...(baseSnapshotWithoutStakedMetrics.apy ?? null),
      net: stakedSnapshot.apy?.net ?? null,
      grossApr: stakedSnapshot.apy?.grossApr ?? null,
      weeklyNet: stakedSnapshot.apy?.weeklyNet ?? null,
      monthlyNet: stakedSnapshot.apy?.monthlyNet ?? null,
      inceptionNet: stakedSnapshot.apy?.inceptionNet ?? null,
      pricePerShare: stakedSnapshot.apy?.pricePerShare ?? null,
      weeklyPricePerShare: stakedSnapshot.apy?.weeklyPricePerShare ?? null,
      monthlyPricePerShare: stakedSnapshot.apy?.monthlyPricePerShare ?? null,
      label: stakedSnapshot.apy?.label ?? baseSnapshot.apy?.label ?? ''
    },
    fees: {
      ...(baseSnapshotWithoutStakedMetrics.fees ?? null),
      performanceFee: stakedSnapshot.fees?.performanceFee ?? null,
      managementFee: baseSnapshot.fees?.managementFee
    },
    performance: {
      ...baseSnapshotWithoutStakedMetrics.performance,
      historical: stakedSnapshot.performance?.historical,
      oracle: stakedSnapshot.performance?.oracle,
      estimated: stakedSnapshot.performance?.estimated
    }
  }
}

export function patchYBoldVaults(vaults: TDict<TKongVaultListItem>): TDict<TKongVaultListItem> {
  const vaultsWithWorkaround = { ...vaults }
  const yBoldVault = vaultsWithWorkaround[toAddress(YBOLD_VAULT_ADDRESS)]
  const stakedVault = vaultsWithWorkaround[toAddress(YBOLD_STAKING_ADDRESS)]

  if (!yBoldVault || !stakedVault) {
    return vaultsWithWorkaround
  }

  vaultsWithWorkaround[toAddress(YBOLD_VAULT_ADDRESS)] = mergeYBoldVault(yBoldVault, stakedVault)

  return vaultsWithWorkaround
}

export function getHoldingsAliasVaultAddress(address: Address | string | undefined): Address | undefined {
  if (!address) {
    return undefined
  }

  return HOLDINGS_ALIAS_BY_ADDRESS[toAddress(address)]
}

export function getCanonicalHoldingsVaultAddress(address: Address | string | undefined): Address {
  return getHoldingsAliasVaultAddress(address) ?? toAddress(address ?? zeroAddress)
}
