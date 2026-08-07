type HandleDepositStepSuccessParams = {
  label: string
  approvalFlowKey: string
  refetchAllowance?: () => Promise<unknown>
  completeApprovalFlow: (approvalFlowKey: string) => void
}

type AllowanceRefetchResult = {
  error?: unknown
}

export async function handleDepositStepSuccess({
  label,
  approvalFlowKey,
  refetchAllowance,
  completeApprovalFlow
}: HandleDepositStepSuccessParams): Promise<void> {
  if (label !== 'Approve' && label !== 'Sign Permit') return

  if (label === 'Approve') {
    const result = (await refetchAllowance?.()) as AllowanceRefetchResult | undefined
    if (result?.error) throw result.error
  }

  completeApprovalFlow(approvalFlowKey)
}
