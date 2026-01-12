import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawErrorProps {
  // Amount state
  amount: bigint
  debouncedAmount: bigint
  isDebouncing: boolean
  // Balance
  requiredShares: bigint
  totalBalance: bigint
  // Account
  account?: Address
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
  account,
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
    if (amount === 0n) return null

    if (!account) return 'Wallet not connected'

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
    account,
    isLoadingRoute,
    flowError,
    routeType,
    hasBothBalances,
    withdrawalSource
  ])
}
