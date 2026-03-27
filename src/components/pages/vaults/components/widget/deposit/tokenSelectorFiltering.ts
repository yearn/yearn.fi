import {
  getVaultAddress,
  getVaultStaking,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_LOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TDict } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
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

    const isHidden = 'info' in vault ? Boolean(vault.info?.isHidden) : Boolean(vault.isHidden)
    if (isHidden) {
      excluded.add(candidateVaultAddress)

      const stakingAddress = toAddress(getVaultStaking(vault).address) as Address
      if (!isZeroAddress(stakingAddress)) {
        excluded.add(stakingAddress)
      }
    }
  })

  /**************************************************************************
   ** Locked yvUSD shares are not transferable until cooldown completes, so
   ** they should never be offered as zap-from inputs. Once Kong exposes a
   ** locked/non-transferable vault flag, replace this hard-coded exclusion
   ** with metadata-driven filtering.
   **************************************************************************/
  excluded.add(YVUSD_LOCKED_ADDRESS)

  return [...excluded]
}
