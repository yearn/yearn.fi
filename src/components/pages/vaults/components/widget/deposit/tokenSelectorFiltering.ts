import { getVaultAddress, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

export function getStructurallyExcludedDepositTokenAddresses({
  allVaults,
  destinationVaultAddress
}: {
  allVaults: TDict<TKongVaultInput>
  destinationVaultAddress: Address
}): Address[] {
  const normalizedDestinationVaultAddress = toAddress(destinationVaultAddress)
  const excluded = new Set<Address>()

  Object.values(allVaults).forEach((vault) => {
    const candidateVaultAddress = toAddress(getVaultAddress(vault)) as Address
    const candidateUnderlyingAddress = toAddress(getVaultToken(vault).address)

    if (candidateUnderlyingAddress === normalizedDestinationVaultAddress) {
      excluded.add(candidateVaultAddress)
    }
  })

  if (normalizedDestinationVaultAddress === YVUSD_UNLOCKED_ADDRESS) {
    excluded.add(YVUSD_LOCKED_ADDRESS)
  }

  return [...excluded]
}
