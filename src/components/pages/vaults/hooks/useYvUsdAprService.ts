import { useFetch } from '@shared/hooks/useFetch'
import { toAddress } from '@shared/utils'
import {
  type TYvUsdAprServiceResponse,
  type TYvUsdAprServiceVault,
  yvUsdAprServiceSchema
} from '@shared/utils/schemas/yvUsdAprServiceSchema'
import { YVUSD_APR_SERVICE_ENDPOINT, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'

type TYvUsdAprServiceData = {
  unlocked?: TYvUsdAprServiceVault
  locked?: TYvUsdAprServiceVault
  isLoading: boolean
  error?: Error
}

function getAprServiceVault(
  data: TYvUsdAprServiceResponse | undefined,
  address: string
): TYvUsdAprServiceVault | undefined {
  return Object.values(data ?? {}).find((vault) => toAddress(vault.address) === address)
}

export function useYvUsdAprService(): TYvUsdAprServiceData {
  const { data, isLoading, error } = useFetch<TYvUsdAprServiceResponse>({
    endpoint: YVUSD_APR_SERVICE_ENDPOINT,
    schema: yvUsdAprServiceSchema,
    config: {
      cacheDuration: 30 * 1000,
      shouldEnableRefreshInterval: true,
      refreshInterval: 30 * 1000
    }
  })

  const unlocked = getAprServiceVault(data, YVUSD_UNLOCKED_ADDRESS)
  const locked = getAprServiceVault(data, YVUSD_LOCKED_ADDRESS)

  return {
    unlocked,
    locked,
    isLoading,
    error: error ?? undefined
  }
}
