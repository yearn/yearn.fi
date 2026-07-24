import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import type { VaultWidgetTransactionPlan } from '../types'
import { executeVaultWidgetPlan } from './executeTransactionPlan'

const account = '0x1111111111111111111111111111111111111111'
const hash = `0x${'22'.repeat(32)}` as const
const request = {
  chainId: 1,
  data: '0x1234' as const,
  to: '0x3333333333333333333333333333333333333333' as const
}
const plan: VaultWidgetTransactionPlan = {
  id: 'rewards:test',
  mode: 'rewards',
  quote: {
    adapterId: 'staking-rewards',
    amountIn: 0n,
    expectedOut: 1n,
    minExpectedOut: 1n,
    positionAmount: 0n,
    transaction: request
  },
  steps: [
    { id: 'rewards', kind: 'execute', label: 'Claim rewards', chainId: 1, request },
    { id: 'refresh', kind: 'refresh', label: 'Refresh balances' }
  ],
  walletType: 'eoa'
}

describe('executeVaultWidgetPlan', () => {
  it('runs execution, receipt, and refresh steps through one state machine', async () => {
    const execute = vi.fn().mockResolvedValue(hash)
    const waitForReceipt = vi.fn().mockResolvedValue(undefined)
    const onExecution = vi.fn()
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn().mockResolvedValue(undefined)

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: { execute, waitForReceipt },
        onExecution,
        onProgress,
        onRefresh,
        plan
      })
    ).resolves.toEqual({ hash })

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ account, request }))
    expect(waitForReceipt).toHaveBeenCalledWith(expect.anything(), 1, hash)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ hash, isFinalTransaction: true, stepIndex: 0 }))
    expect(onExecution).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', hash }))
  })

  it('marks only the final submitted transaction as workflow-completing', async () => {
    const approvalHash = `0x${'44'.repeat(32)}` as const
    const executionHash = `0x${'55'.repeat(32)}` as const
    const execute = vi.fn().mockResolvedValueOnce(approvalHash).mockResolvedValueOnce(executionHash)
    const onProgress = vi.fn().mockResolvedValue(undefined)
    const multiStepPlan: VaultWidgetTransactionPlan = {
      ...plan,
      steps: [
        { id: 'approve', kind: 'approve', label: 'Approve', chainId: 1, request },
        { id: 'execute', kind: 'execute', label: 'Deposit', chainId: 1, request },
        { id: 'refresh', kind: 'refresh', label: 'Refresh balances' }
      ]
    }

    await executeVaultWidgetPlan({
      account,
      config: {} as Config,
      execution: { execute, waitForReceipt: vi.fn().mockResolvedValue(undefined) },
      onExecution: vi.fn(),
      onProgress,
      onRefresh: vi.fn().mockResolvedValue(undefined),
      plan: multiStepPlan
    })

    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ hash: approvalHash, isFinalTransaction: false, stepIndex: 0 })
    )
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ hash: executionHash, isFinalTransaction: true, stepIndex: 1 })
    )
  })

  it('does not associate a prior transaction hash with a later Safe proposal', async () => {
    const proposalId = '0x1234' as const
    const onProgress = vi.fn().mockResolvedValue(undefined)
    const safePlan: VaultWidgetTransactionPlan = {
      ...plan,
      walletType: 'safe',
      steps: [
        { id: 'prior', kind: 'execute', label: 'Prior transaction', chainId: 1, request },
        { id: 'safe', kind: 'safe-proposal', label: 'Propose batch', chainId: 1, requests: [request] }
      ]
    }

    await executeVaultWidgetPlan({
      account,
      config: {} as Config,
      execution: {
        execute: vi.fn().mockResolvedValue(hash),
        proposeSafeBatch: vi.fn().mockResolvedValue(proposalId),
        waitForReceipt: vi.fn().mockResolvedValue(undefined)
      },
      onExecution: vi.fn(),
      onProgress,
      onRefresh: vi.fn().mockResolvedValue(undefined),
      plan: safePlan
    })

    const safeProgress = onProgress.mock.calls[1]?.[0]
    expect(safeProgress).toMatchObject({ isFinalTransaction: true, proposalId })
    expect(safeProgress).not.toHaveProperty('hash')
  })
})
