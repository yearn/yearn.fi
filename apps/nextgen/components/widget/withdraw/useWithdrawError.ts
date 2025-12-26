import { useMemo } from 'react'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawErrorProps {
  // Amount state
  amount: bigint
  debouncedAmount: bigint
  isDebouncing: boolean
  // Balance
  requiredShares: bigint
  totalBalance: bigint
  // Flow state
  isLoadingRoute: boolean
  flowError?: unknown
  routeType: WithdrawRouteType
  // Source selection
  hasBothBalances: boolean
  withdrawalSource: WithdrawalSource
}

export const useWithdrawError = ({
  amount,
  debouncedAmount,
  isDebouncing,
  requiredShares,
  totalBalance,
  isLoadingRoute,
  flowError,
  routeType,
  hasBothBalances,
  withdrawalSource
}: UseWithdrawErrorProps): string | null => {
  return useMemo(() => {
    if (hasBothBalances && !withdrawalSource) {
      return 'Please select withdrawal source'
    }
    console.log(amount, requiredShares, totalBalance)
    if (amount === 0n) return null

    if (requiredShares > totalBalance) {
      return 'Insufficient balance'
    }

    // Route-dependent validation - wait for debounce and route fetch
    if (routeType === 'ENSO') {
      if (flowError && !isLoadingRoute && debouncedAmount > 0n && !isDebouncing) {
        return 'Unable to find route'
      }
    }

    return null
  }, [
    amount,
    debouncedAmount,
    isDebouncing,
    requiredShares,
    totalBalance,
    isLoadingRoute,
    flowError,
    routeType,
    hasBothBalances,
    withdrawalSource
  ])
}
