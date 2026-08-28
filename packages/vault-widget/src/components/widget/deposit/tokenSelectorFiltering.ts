import { toAddress } from '@yearn/vault-widget/internal/utils'
import { YVUSD_LOCKED_ADDRESS } from '@yearn/vault-widget/internal/utils/yvUsd'
import type { VaultWidgetCatalogVault } from '@yearn/vault-widget/runtime'
import { type Address, zeroAddress } from 'viem'

export function getStructurallyExcludedDepositTokenAddresses({
  allVaults,
  destinationVaultAddress
}: {
  allVaults: readonly VaultWidgetCatalogVault[]
  destinationVaultAddress: Address
}): Address[] {
  const normalizedDestinationVaultAddress = toAddress(destinationVaultAddress)
  const excluded = new Set<Address>()

  allVaults.forEach((vault) => {
    const candidateVaultAddress = toAddress(vault.address) as Address
    const candidateUnderlyingAddress = toAddress(vault.assetAddress)

    if (candidateUnderlyingAddress === normalizedDestinationVaultAddress) {
      excluded.add(candidateVaultAddress)
    }

    if (vault.hidden) {
      excluded.add(candidateVaultAddress)

      const stakingAddress = vault.stakingAddress
      if (stakingAddress && stakingAddress !== zeroAddress) {
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
