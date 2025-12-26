import { useMemo } from 'react'
import type { Address } from 'viem'

interface UseDepositErrorProps {
  // Amount state
  amount: bigint
  debouncedAmount: bigint
  isDebouncing: boolean
  // Balance
  balance: bigint
  // Flow state
  isLoadingRoute: boolean
  flowError?: unknown
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
  isLoadingRoute,
  flowError,
  selectedToken,
  vaultAddress,
  isAutoStakingEnabled
}: UseDepositErrorProps): string | null => {
  return useMemo(() => {
    if (amount === 0n) return null

    if (amount > balance) return 'Insufficient balance'

    if (selectedToken === vaultAddress && !isAutoStakingEnabled) {
      return "Please toggle 'Maximize Yield' switch in settings to stake"
    }

    // Route-dependent validation - wait for debounce and route fetch
    if (flowError && !isLoadingRoute && debouncedAmount > 0n && !isDebouncing) {
      return 'Unable to find route'
    }

    return null
  }, [
    amount,
    debouncedAmount,
    isDebouncing,
    balance,
    isLoadingRoute,
    flowError,
    selectedToken,
    vaultAddress,
    isAutoStakingEnabled
  ])
}
