type AllowanceRefetchResult = {
  data?: unknown
  error?: unknown
}

type HandleDepositStepSuccessParams = {
  stepId: string
  approvalFlowKey: string
  requiredAllowance: bigint
  refetchAllowance?: () => Promise<unknown>
  completeApprovalFlow: (approvalFlowKey: string) => void
  maxAttempts?: number
  retryDelayMs?: number
}

export async function handleDepositStepSuccess({
  stepId,
  approvalFlowKey,
  requiredAllowance,
  refetchAllowance,
  completeApprovalFlow,
  maxAttempts = 5,
  retryDelayMs = 1_000
}: HandleDepositStepSuccessParams): Promise<void> {
  if (stepId !== 'approve' && stepId !== 'permit') return

  if (stepId === 'approve') {
    if (!refetchAllowance) throw new Error('Allowance refresh is unavailable.')

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = (await refetchAllowance()) as AllowanceRefetchResult
      if (result.error) throw result.error
      if (typeof result.data === 'bigint' && result.data >= requiredAllowance) {
        completeApprovalFlow(approvalFlowKey)
        return
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }

    throw new Error('The confirmed approval is not visible on the source network yet.')
  }

  completeApprovalFlow(approvalFlowKey)
}
