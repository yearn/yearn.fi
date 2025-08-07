// Temp file, remove logic at a later date

import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { type Address, isAddressEqual, zeroAddress } from 'viem'

const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
const STAKED_YBOLD_VAULT_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

const params = new URLSearchParams({
  strategiesDetails: 'withDetails',
  strategiesCondition: 'inQueue'
})

export const fetchYBoldVault = async (
  yDaemonBaseUri: string,
  vault?: TYDaemonVault
): Promise<TYDaemonVault | undefined> => {
  if (!vault || !isAddressEqual(vault.address, YBOLD_VAULT_ADDRESS)) {
    return undefined
  }

  try {
    const res = await fetch(
      `${yDaemonBaseUri}/vaults/${toAddress(STAKED_YBOLD_VAULT_ADDRESS)}?${params}`
    )
    const json = await res.json()
    const parsed: TYDaemonVault = yDaemonVaultSchema.parse(json)
    return {
      ...vault,
      staking: {
        address: STAKED_YBOLD_VAULT_ADDRESS,
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
      apr: {
        ...vault.apr,
        netAPR: parsed?.apr?.netAPR || vault.apr.netAPR || 0,
        points: parsed?.apr?.points || vault.apr.points || {},
        pricePerShare: parsed?.apr?.pricePerShare || vault.apr.pricePerShare || {}
      }
    }
  } catch (error) {
    console.log('error', error)
    console.error(error)
    return undefined
  }
}
