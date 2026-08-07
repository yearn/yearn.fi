import { handleDepositStepSuccess } from '@pages/vaults/components/widget/deposit/depositStepSuccess'
import { describe, expect, it, vi } from 'vitest'

describe('handleDepositStepSuccess', () => {
  it('refreshes the confirmed allowance before completing an approval flow', async () => {
    const events: string[] = []
    const refetchAllowance = vi.fn(async () => {
      events.push('allowance-refreshed')
    })
    const completeApprovalFlow = vi.fn(() => {
      events.push('approval-completed')
    })

    await handleDepositStepSuccess({
      label: 'Approve',
      approvalFlowKey: 'enso-cross-chain-deposit',
      refetchAllowance,
      completeApprovalFlow
    })

    expect(events).toEqual(['allowance-refreshed', 'approval-completed'])
    expect(completeApprovalFlow).toHaveBeenCalledWith('enso-cross-chain-deposit')
  })

  it('does not advance when the confirmed allowance cannot be refreshed', async () => {
    const error = new Error('allowance RPC failed')
    const completeApprovalFlow = vi.fn()

    await expect(
      handleDepositStepSuccess({
        label: 'Approve',
        approvalFlowKey: 'enso-cross-chain-deposit',
        refetchAllowance: vi.fn().mockRejectedValue(error),
        completeApprovalFlow
      })
    ).rejects.toThrow(error)

    expect(completeApprovalFlow).not.toHaveBeenCalled()
  })

  it('does not advance when the allowance refresh resolves with a query error', async () => {
    const error = new Error('allowance read failed')
    const completeApprovalFlow = vi.fn()

    await expect(
      handleDepositStepSuccess({
        label: 'Approve',
        approvalFlowKey: 'enso-cross-chain-deposit',
        refetchAllowance: vi.fn().mockResolvedValue({ error }),
        completeApprovalFlow
      })
    ).rejects.toThrow(error)

    expect(completeApprovalFlow).not.toHaveBeenCalled()
  })

  it('completes permit flows without refetching an on-chain allowance', async () => {
    const refetchAllowance = vi.fn()
    const completeApprovalFlow = vi.fn()

    await handleDepositStepSuccess({
      label: 'Sign Permit',
      approvalFlowKey: 'permit-deposit',
      refetchAllowance,
      completeApprovalFlow
    })

    expect(refetchAllowance).not.toHaveBeenCalled()
    expect(completeApprovalFlow).toHaveBeenCalledWith('permit-deposit')
  })
})
