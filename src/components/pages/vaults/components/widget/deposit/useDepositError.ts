import { useMemo } from 'react'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'

interface UseDepositErrorProps {
  // Amount state
  amount: bigint
  debouncedAmount: bigint
  isDebouncing: boolean
  // Balance
  balance: bigint
  // Account
  account?: Address
  // Flow state
  isLoadingRoute: boolean
  flowError?: unknown
  routeType: DepositRouteType
  // Settings
  selectedToken?: Address
  vaultAddress: Address
  isAutoStakingEnabled: boolean
}

export const useDepositError = ({
  amount,
  debouncedAmount,
  isDebouncing,
  balance,
  account,
  isLoadingRoute,
  flowError,
  routeType,
  selectedToken,
  vaultAddress,
  isAutoStakingEnabled
}: UseDepositErrorProps): string | null => {
  return useMemo(() => {
    if (amount === 0n) return null

    if (!account) return 'Wallet not connected'

    if (amount > balance) return 'Insufficient balance'

    if (selectedToken === vaultAddress && !isAutoStakingEnabled) {
      return "Please toggle 'Stake Automatically' switch in settings to stake"
    }

    // Route-dependent validation - wait for debounce and route fetch
    if (routeType === 'NO_ROUTE' && debouncedAmount > 0n && !isDebouncing) {
      return 'No route available for selected token'
    }

    if (routeType === 'ENSO' && flowError && !isLoadingRoute && debouncedAmount > 0n && !isDebouncing) {
      return 'Unable to find route'
    }

    return null
  }, [
    amount,
    debouncedAmount,
    isDebouncing,
    balance,
    account,
    isLoadingRoute,
    flowError,
    routeType,
    selectedToken,
    vaultAddress,
    isAutoStakingEnabled
  ])
}
