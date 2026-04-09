'use client'

import {
  getVaultAddress,
  getVaultChainID,
  getVaultStaking,
  type TKongVault,
  type TKongVaultStaking
} from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultSnapshot } from '@pages/vaults/hooks/useVaultSnapshot'
import { isZeroAddress } from '@shared/utils'

type UseVaultWithStakingRewardsReturn = {
  vault: TKongVault
  staking: TKongVaultStaking
  isLoading: boolean
}

export function useVaultWithStakingRewards(
  originalVault: TKongVault,
  enabled: boolean
): UseVaultWithStakingRewardsReturn {
  const baseStaking = getVaultStaking(originalVault)
  const chainId = getVaultChainID(originalVault)
  const address = getVaultAddress(originalVault)
  const needsFetch = enabled && !isZeroAddress(baseStaking.address)

  const { data: snapshot, isLoading } = useVaultSnapshot({
    chainId: needsFetch ? chainId : undefined,
    address: needsFetch ? address : undefined
  })

  const staking = getVaultStaking(originalVault, snapshot)

  return { vault: originalVault, staking, isLoading: needsFetch && isLoading }
}
