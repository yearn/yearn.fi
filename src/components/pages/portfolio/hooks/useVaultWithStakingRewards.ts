import { useFetch } from '@shared/hooks/useFetch'
import { useYDaemonBaseURI } from '@shared/hooks/useYDaemonBaseURI'
import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'

type UseVaultWithStakingRewardsReturn = {
  vault: TYDaemonVault
  isLoading: boolean
}

export function useVaultWithStakingRewards(
  originalVault: TYDaemonVault,
  enabled: boolean
): UseVaultWithStakingRewardsReturn {
  const { yDaemonBaseUri } = useYDaemonBaseURI({ chainID: originalVault.chainID })

  const needsFetch =
    enabled &&
    originalVault.staking.available &&
    (!originalVault.staking.rewards || originalVault.staking.rewards.length === 0)

  const endpoint = useMemo(() => {
    if (!needsFetch) return null
    return `${yDaemonBaseUri}/vaults/${toAddress(originalVault.address)}`
  }, [needsFetch, yDaemonBaseUri, originalVault.address])

  const { data: fetchedVault, isLoading } = useFetch<TYDaemonVault>({
    endpoint,
    schema: yDaemonVaultSchema
  })

  const vault = useMemo(() => {
    if (fetchedVault?.staking.rewards && fetchedVault.staking.rewards.length > 0) {
      return fetchedVault
    }
    return originalVault
  }, [fetchedVault, originalVault])

  return { vault, isLoading: needsFetch && isLoading }
}
