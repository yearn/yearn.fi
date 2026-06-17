import { requiresAllowanceResetBeforeApproval } from '@shared/utils/approve'
import type { Address } from 'viem'

type TShouldBlockDepositApprovalForAllowanceReset = {
  depositToken?: Address
  currentAllowance: bigint
  requiredAmount: bigint
  needsApproval: boolean
}

export function shouldBlockDepositApprovalForAllowanceReset({
  depositToken,
  currentAllowance,
  requiredAmount,
  needsApproval
}: TShouldBlockDepositApprovalForAllowanceReset): boolean {
  return (
    needsApproval &&
    requiresAllowanceResetBeforeApproval(depositToken) &&
    requiredAmount > 0n &&
    currentAllowance > 0n &&
    currentAllowance < requiredAmount
  )
}
