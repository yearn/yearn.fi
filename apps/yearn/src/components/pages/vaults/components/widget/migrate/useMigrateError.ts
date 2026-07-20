import { useMemo } from 'react'
import type { Address } from 'viem'

interface UseMigrateErrorProps {
  balance: bigint
  account?: Address
  simulationError?: unknown
  isSimulating: boolean
}

export const useMigrateError = ({
  balance,
  account,
  simulationError,
  isSimulating
}: UseMigrateErrorProps): string | null => {
  return useMemo(() => {
    if (!account) return 'Wallet not connected'

    if (balance === 0n) return 'Nothing to migrate'

    if (simulationError && !isSimulating) {
      return 'Migration not available'
    }

    return null
  }, [balance, account, simulationError, isSimulating])
}
