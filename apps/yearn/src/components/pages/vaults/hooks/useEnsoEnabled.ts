import { isVaultEnsoDisabled } from '@pages/vaults/constants/ensoDisabledVaults'
import { useEnsoStatus } from '@pages/vaults/contexts/useEnsoStatus'
import { getRoutingChains } from '@yearn/chains'
import type { Address } from 'viem'
import { env } from '@/env'

interface UseEnsoEnabledOptions {
  chainId?: number
  vaultAddress?: Address
}

export function useEnsoEnabled({ chainId, vaultAddress }: UseEnsoEnabledOptions = {}): boolean {
  const { isEnsoFailed } = useEnsoStatus()
  const envDisabled = env.NEXT_PUBLIC_ENSO_DISABLED === 'true'

  if (
    envDisabled ||
    isEnsoFailed ||
    (chainId !== undefined && !getRoutingChains('yearn').some(({ id }) => id === chainId))
  ) {
    return false
  }

  if (isVaultEnsoDisabled(chainId, vaultAddress)) {
    return false
  }

  return true
}
