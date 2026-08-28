import type { TAddress } from '@shared/types/address'
import { DISABLED_VEYFI_GAUGES_VAULTS_LIST } from '@shared/utils/constants'
import { toAddress } from '@shared/utils/tools.address'

export function isDisabledVeyfiGaugePair(vaultAddress: TAddress, stakingAddress: TAddress): boolean {
  return DISABLED_VEYFI_GAUGES_VAULTS_LIST.some(
    ({ address, staking }) => toAddress(address) === vaultAddress && toAddress(staking) === stakingAddress
  )
}
