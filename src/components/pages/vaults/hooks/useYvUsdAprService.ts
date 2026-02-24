import { useFetch } from '@shared/hooks/useFetch'
import { toAddress } from '@shared/utils'
import {
  type TYvUsdAprServiceResponse,
  type TYvUsdAprServiceVault,
  yvUsdAprServiceSchema
} from '@shared/utils/schemas/yvUsdAprServiceSchema'
import { useMemo } from 'react'
import {
  YVUSD_APR_SERVICE_ENDPOINT,
  YVUSD_LEGACY_LOCKED_ADDRESS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '../utils/yvUsd'

type TYvUsdAprServiceData = {
  unlocked?: TYvUsdAprServiceVault
  locked?: TYvUsdAprServiceVault
  isLoading: boolean
  error?: Error
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

  const vaultsByAddress = useMemo(() => {
    const entries = Object.values(data ?? {}).map((vault) => [toAddress(vault.address), vault] as const)
    return new Map(entries)
  }, [data])

  const unlocked = vaultsByAddress.get(YVUSD_UNLOCKED_ADDRESS)
  const locked = vaultsByAddress.get(YVUSD_LOCKED_ADDRESS) ?? vaultsByAddress.get(YVUSD_LEGACY_LOCKED_ADDRESS)

  return {
    unlocked,
    locked,
    isLoading,
    error: error ?? undefined
  }
}
