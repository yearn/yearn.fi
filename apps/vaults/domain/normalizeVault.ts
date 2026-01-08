import type { TDict } from '@lib/types'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { type Address, zeroAddress } from 'viem'

export const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
export const YBOLD_STAKING_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

export function mergeYBoldVault(baseVault: TYDaemonVault, stakedVault: TYDaemonVault): TYDaemonVault {
  return {
    ...baseVault,
    staking: {
      address: YBOLD_STAKING_ADDRESS,
      available: true,
      source: 'yBOLD',
      rewards: [
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
    apr:
      baseVault.apr && stakedVault.apr
        ? {
            ...baseVault.apr,
            netAPR: stakedVault.apr.netAPR ?? baseVault.apr.netAPR ?? 0,
            points: { ...(stakedVault.apr.points ?? baseVault.apr.points ?? {}) },
            pricePerShare: {
              ...(stakedVault.apr.pricePerShare ?? baseVault.apr.pricePerShare ?? {})
            },
            fees: {
              ...baseVault.apr.fees,
              performance: stakedVault.apr.fees.performance ?? baseVault.apr.fees.performance ?? 0
            }
          }
        : baseVault.apr
  }
}

export function patchYBoldVaults(vaults: TDict<TYDaemonVault>): TDict<TYDaemonVault> {
  const vaultsWithWorkaround = { ...vaults }
  const yBoldVault = vaultsWithWorkaround[toAddress(YBOLD_VAULT_ADDRESS)]
  const stakedVault = vaultsWithWorkaround[toAddress(YBOLD_STAKING_ADDRESS)]

  if (!yBoldVault || !stakedVault) {
    return vaultsWithWorkaround
  }

  vaultsWithWorkaround[toAddress(YBOLD_VAULT_ADDRESS)] = mergeYBoldVault(yBoldVault, stakedVault)

  return vaultsWithWorkaround
}
