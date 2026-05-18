import { useFetch } from '@shared/hooks/useFetch'
import { toAddress } from '@shared/utils'
import {
  type TYvUsdAprServicePointsResponse,
  type TYvUsdAprServicePointsVault,
  yvUsdAprServicePointsSchema
} from '@shared/utils/schemas/yvUsdAprServiceSchema'
import { YVUSD_APR_SERVICE_ENDPOINT, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'

type TYvUsdPointsData = {
  unlocked: boolean
  locked: boolean
  isLoading: boolean
}

function getAprServiceVault(
  data: TYvUsdAprServicePointsResponse | undefined,
  address: string
): TYvUsdAprServicePointsVault | undefined {
  return Object.values(data ?? {}).find((vault) => toAddress(vault.address) === address)
}

function hasPositiveDebt(rawDebt?: string): boolean {
  if (!rawDebt) {
    return false
  }

  try {
    return BigInt(rawDebt) > 0n
  } catch {
    return false
  }
}

export function hasInfinifiPoints(vault?: TYvUsdAprServicePointsVault): boolean {
  return (vault?.meta?.strategies || []).some((strategy) => strategy.points === true && hasPositiveDebt(strategy.debt))
}

export function useYvUsdPoints(): TYvUsdPointsData {
  const { data, isLoading } = useFetch<TYvUsdAprServicePointsResponse>({
    endpoint: YVUSD_APR_SERVICE_ENDPOINT,
    schema: yvUsdAprServicePointsSchema,
    config: {
      cacheDuration: 30 * 1000,
      shouldEnableRefreshInterval: true,
      refreshInterval: 30 * 1000
    }
  })

  const unlocked = getAprServiceVault(data, YVUSD_UNLOCKED_ADDRESS)
  const locked = getAprServiceVault(data, YVUSD_LOCKED_ADDRESS)

  return {
    unlocked: hasInfinifiPoints(unlocked),
    locked: hasInfinifiPoints(locked),
    isLoading
  }
}
