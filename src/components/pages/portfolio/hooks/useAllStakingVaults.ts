import { useYearn } from '@shared/contexts/useYearn'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'

export function useAllStakingVaults(): TYDaemonVault[] {
  const { vaults } = useYearn()

  return useMemo(() => Object.values(vaults).filter((vault) => vault.staking.available), [vaults])
}
