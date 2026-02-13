import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { type Address, zeroAddress } from 'viem'

export const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
export const YBOLD_STAKING_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

export function mergeYBoldVault(baseVault: TKongVaultListItem, stakedVault: TKongVaultListItem): TKongVaultListItem {
  return {
    ...baseVault,
    staking: {
      address: YBOLD_STAKING_ADDRESS,
      available: true
    },
    performance: {
      ...(baseVault.performance ?? {}),
      historical: stakedVault.performance?.historical ?? baseVault.performance?.historical,
      estimated: stakedVault.performance?.estimated ?? baseVault.performance?.estimated,
      oracle: stakedVault.performance?.oracle ?? baseVault.performance?.oracle
    },
    fees: {
      managementFee: baseVault.fees?.managementFee ?? 0,
      performanceFee: stakedVault.fees?.performanceFee ?? baseVault.fees?.performanceFee ?? 0
    }
  }
}

export function mergeYBoldSnapshot(
  baseSnapshot: TKongVaultSnapshot,
  stakedSnapshot: TKongVaultSnapshot
): TKongVaultSnapshot {
  return {
    ...baseSnapshot,
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
      ...(baseSnapshot.apy ?? null),
      net: stakedSnapshot.apy?.net ?? baseSnapshot.apy?.net,
      weeklyNet: stakedSnapshot.apy?.weeklyNet ?? baseSnapshot.apy?.weeklyNet,
      monthlyNet: stakedSnapshot.apy?.monthlyNet ?? baseSnapshot.apy?.monthlyNet,
      inceptionNet: stakedSnapshot.apy?.inceptionNet ?? baseSnapshot.apy?.inceptionNet,
      pricePerShare: stakedSnapshot.apy?.pricePerShare ?? baseSnapshot.apy?.pricePerShare,
      weeklyPricePerShare: stakedSnapshot.apy?.weeklyPricePerShare ?? baseSnapshot.apy?.weeklyPricePerShare,
      monthlyPricePerShare: stakedSnapshot.apy?.monthlyPricePerShare ?? baseSnapshot.apy?.monthlyPricePerShare,
      label: stakedSnapshot.apy?.label ?? baseSnapshot.apy?.label ?? ''
    },
    fees: {
      ...(baseSnapshot.fees ?? null),
      performanceFee: stakedSnapshot.fees?.performanceFee ?? baseSnapshot.fees?.performanceFee,
      managementFee: baseSnapshot.fees?.managementFee
    },
    performance: {
      ...(baseSnapshot.performance ?? {}),
      historical: stakedSnapshot.performance?.historical ?? baseSnapshot.performance?.historical,
      oracle: stakedSnapshot.performance?.oracle ?? baseSnapshot.performance?.oracle,
      estimated: stakedSnapshot.performance?.estimated ?? baseSnapshot.performance?.estimated
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
