import { describe, expect, it, vi } from 'vitest'
import { handleDepositStepSuccess } from './depositStepSuccess'

describe('handleDepositStepSuccess', () => {
  it('waits for sufficient source-chain allowance before completing approval', async () => {
    const refetchAllowance = vi
      .fn()
      .mockResolvedValueOnce({ data: 0n })
      .mockResolvedValueOnce({ data: 20n })
    const completeApprovalFlow = vi.fn()

    await handleDepositStepSuccess({
      stepId: 'approve',
      approvalFlowKey: 'katana-to-base',
      requiredAllowance: 10n,
      refetchAllowance,
      completeApprovalFlow,
      retryDelayMs: 0
    })

    expect(refetchAllowance).toHaveBeenCalledTimes(2)
    expect(completeApprovalFlow).toHaveBeenCalledWith('katana-to-base')
  })

  it('does not complete approval when the source-chain allowance stays stale', async () => {
    const completeApprovalFlow = vi.fn()

    await expect(
      handleDepositStepSuccess({
        stepId: 'approve',
        approvalFlowKey: 'katana-to-base',
        requiredAllowance: 10n,
        refetchAllowance: vi.fn().mockResolvedValue({ data: 0n }),
        completeApprovalFlow,
        maxAttempts: 2,
        retryDelayMs: 0
      })
    ).rejects.toThrow('not visible on the source network')

    expect(completeApprovalFlow).not.toHaveBeenCalled()
  })

  it('completes permit steps without reading allowance', async () => {
    const refetchAllowance = vi.fn()
    const completeApprovalFlow = vi.fn()

    await handleDepositStepSuccess({
      stepId: 'permit',
      approvalFlowKey: 'permit-deposit',
      requiredAllowance: 10n,
      refetchAllowance,
      completeApprovalFlow
    })

    expect(refetchAllowance).not.toHaveBeenCalled()
    expect(completeApprovalFlow).toHaveBeenCalledWith('permit-deposit')
  })
})
