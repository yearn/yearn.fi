import { isAddressEqual } from 'viem'
import type { VaultWidgetApprovalTarget, VaultWidgetQuote } from '../types'

export function getQuoteApprovalTargets(quote?: VaultWidgetQuote): readonly VaultWidgetApprovalTarget[] {
  if (quote?.approvals?.length) return quote.approvals
  return quote?.approval ? [quote.approval] : []
}

export function isSameApprovalTarget(left: VaultWidgetApprovalTarget, right: VaultWidgetApprovalTarget): boolean {
  return (
    left.token.chainId === right.token.chainId &&
    isAddressEqual(left.token.address, right.token.address) &&
    isAddressEqual(left.spender, right.spender)
  )
}

export function matchApprovalAllowances(
  quote: VaultWidgetQuote,
  currentTargets: readonly VaultWidgetApprovalTarget[],
  currentAllowances: readonly bigint[]
): readonly bigint[] {
  return getQuoteApprovalTargets(quote).map((target) => {
    const index = currentTargets.findIndex((candidate) => isSameApprovalTarget(candidate, target))
    return index === -1 ? 0n : (currentAllowances[index] ?? 0n)
  })
}
