import { requiresAllowanceResetBeforeApproval } from '@shared/utils/approve'
import type { Address } from 'viem'

type TShouldBlockDepositApprovalForAllowanceReset = {
  depositToken?: Address
  currentAllowance: bigint
  requiredAmount: bigint
  availableBalance: bigint
  needsApproval: boolean
}

export function shouldBlockDepositApprovalForAllowanceReset({
  depositToken,
  currentAllowance,
  requiredAmount,
  availableBalance,
  needsApproval
}: TShouldBlockDepositApprovalForAllowanceReset): boolean {
  return (
    needsApproval &&
    requiresAllowanceResetBeforeApproval(depositToken) &&
    requiredAmount > 0n &&
    availableBalance >= requiredAmount &&
    currentAllowance > 0n &&
    currentAllowance < requiredAmount
  )
}
