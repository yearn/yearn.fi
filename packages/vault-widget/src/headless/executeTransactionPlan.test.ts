import type { Hash, TransactionReceipt } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { buildTransactionPlan } from './buildTransactionPlan'
import {
  type ExecuteTransactionPlanParams,
  executeTransactionPlan,
  VaultWidgetPlanExecutionError
} from './executeTransactionPlan'
import type { VaultWidgetExecutionAdapter, VaultWidgetPlanExecutionState, VaultWidgetTransactionIntent } from './types'

const account = '0x1111111111111111111111111111111111111111' as const
const hashOne = `0x${'1'.repeat(64)}` as Hash
const hashTwo = `0x${'2'.repeat(64)}` as Hash
const safeHash = `0x${'3'.repeat(64)}` as Hash
const proposalId = '0x1234' as const

function createReceipt(hash: Hash, status: TransactionReceipt['status'] = 'success'): TransactionReceipt {
  return { status, transactionHash: hash } as TransactionReceipt
}

function createIntent(callCount = 1): VaultWidgetTransactionIntent {
  return {
    id: `deposit:test:${callCount}`,
    mode: 'deposit',
    calls: [
      {
        id: 'deposit',
        label: 'Deposit',
        request: {
          chainId: 1,
          to: '0x2222222222222222222222222222222222222222',
          data: '0x1234'
        }
      },
      ...(callCount > 1
        ? [
            {
              id: 'stake',
              label: 'Stake',
              request: {
                chainId: 1,
                to: '0x3333333333333333333333333333333333333333' as const,
                data: '0x5678' as const
              }
            }
          ]
        : [])
    ]
  }
}

function createAdapter(overrides: Partial<VaultWidgetExecutionAdapter> = {}): VaultWidgetExecutionAdapter {
  return {
    switchChain: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue(hashOne),
    waitForReceipt: vi.fn().mockResolvedValue(createReceipt(hashOne)),
    ...overrides
  }
}

async function captureExecutionError(params: ExecuteTransactionPlanParams): Promise<VaultWidgetPlanExecutionError> {
  return executeTransactionPlan(params).then(
    () => Promise.reject(new Error('Expected transaction plan execution to fail')),
    (error: unknown) => {
      expect(error).toBeInstanceOf(VaultWidgetPlanExecutionError)
      return error as VaultWidgetPlanExecutionError
    }
  )
}

describe('executeTransactionPlan', () => {
  it('sequences EOA switching, every transaction receipt, refresh, and accumulated state', async () => {
    const order: string[] = []
    const states: VaultWidgetPlanExecutionState[] = []
    const receiptOne = createReceipt(hashOne)
    const receiptTwo = createReceipt(hashTwo)
    const adapter = createAdapter({
      switchChain: vi.fn(async () => {
        order.push('switch')
      }),
      execute: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push('execute-1')
          return hashOne
        })
        .mockImplementationOnce(async () => {
          order.push('execute-2')
          return hashTwo
        }),
      waitForReceipt: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push('receipt-1')
          return receiptOne
        })
        .mockImplementationOnce(async () => {
          order.push('receipt-2')
          return receiptTwo
        })
    })
    const plan = buildTransactionPlan({ intent: createIntent(2), connectedChainId: 10 })

    const outcome = await executeTransactionPlan({
      account,
      adapter,
      plan,
      refresh: async () => {
        order.push('refresh')
      },
      onState: (state) => states.push(state)
    })

    expect(order).toEqual(['switch', 'execute-1', 'receipt-1', 'execute-2', 'receipt-2', 'refresh'])
    expect(states.map(({ status }) => status)).toEqual([
      'confirming',
      'confirming',
      'pending',
      'confirming',
      'pending',
      'refreshing',
      'success'
    ])
    expect(states.map(({ stepIndex, stepCount }) => [stepIndex, stepCount])).toEqual([
      [0, 4],
      [1, 4],
      [1, 4],
      [2, 4],
      [2, 4],
      [3, 4],
      [4, 4]
    ])
    expect(outcome).toEqual({
      submissions: [
        { stepId: 'deposit', chainId: 1, hash: hashOne, receipt: receiptOne },
        { stepId: 'stake', chainId: 1, hash: hashTwo, receipt: receiptTwo }
      ]
    })
    expect(states.at(-1)?.outcome).toEqual(outcome)
  })

  it('executes Safe proposal, execution tracking, mined receipt, and refresh in order', async () => {
    const order: string[] = []
    const states: VaultWidgetPlanExecutionState[] = []
    const receipt = createReceipt(safeHash)
    const adapter = createAdapter({
      proposeSafeBatch: vi.fn(async () => {
        order.push('proposal')
        return proposalId
      }),
      waitForSafeExecution: vi.fn(async () => {
        order.push('safe-execution')
        return safeHash
      }),
      waitForReceipt: vi.fn(async () => {
        order.push('receipt')
        return receipt
      })
    })
    const plan = buildTransactionPlan({ intent: createIntent(), walletType: 'safe' })

    const outcome = await executeTransactionPlan({
      account,
      adapter,
      plan,
      refresh: async () => {
        order.push('refresh')
      },
      onState: (state) => states.push(state)
    })

    expect(order).toEqual(['proposal', 'safe-execution', 'receipt', 'refresh'])
    expect(states.map(({ status }) => status)).toEqual(['confirming', 'submitted', 'pending', 'refreshing', 'success'])
    expect(states[1]?.outcome).toEqual({
      submissions: [{ stepId: 'safe-proposal-1-0', chainId: 1, proposalId }]
    })
    expect(states[2]?.outcome).toEqual({
      submissions: [{ stepId: 'safe-proposal-1-0', chainId: 1, proposalId, hash: safeHash }]
    })
    expect(outcome).toEqual({
      submissions: [{ stepId: 'safe-proposal-1-0', chainId: 1, proposalId, hash: safeHash, receipt }]
    })
  })

  it('preserves a reverted receipt in a typed execution error and skips refresh', async () => {
    const states: VaultWidgetPlanExecutionState[] = []
    const revertedReceipt = createReceipt(hashOne, 'reverted')
    const refresh = vi.fn().mockResolvedValue(undefined)
    const plan = buildTransactionPlan({ intent: createIntent(), connectedChainId: 1 })
    const error = await captureExecutionError({
      account,
      adapter: createAdapter({ waitForReceipt: vi.fn().mockResolvedValue(revertedReceipt) }),
      plan,
      refresh,
      onState: (state) => states.push(state)
    })

    expect(error.message).toBe('Transaction reverted')
    expect(error.step).toMatchObject({ id: 'deposit', kind: 'execute' })
    expect(error.stepIndex).toBe(0)
    expect(error.stepCount).toBe(2)
    expect(error.outcome).toEqual({
      submissions: [{ stepId: 'deposit', chainId: 1, hash: hashOne, receipt: revertedReceipt }]
    })
    expect(states.map(({ status }) => status)).toEqual(['confirming', 'pending', 'error'])
    expect(states.at(-1)).toMatchObject({ error, outcome: error.outcome })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('preserves the wallet rejection as the cause and does not submit or refresh', async () => {
    const walletRejection = new Error('User rejected the request')
    const refresh = vi.fn().mockResolvedValue(undefined)
    const adapter = createAdapter({ execute: vi.fn().mockRejectedValue(walletRejection) })
    const plan = buildTransactionPlan({ intent: createIntent(), connectedChainId: 1 })
    const error = await captureExecutionError({ account, adapter, plan, refresh })

    expect(error.cause).toBe(walletRejection)
    expect(error.step).toMatchObject({ id: 'deposit', kind: 'execute' })
    expect(error.outcome).toEqual({ submissions: [] })
    expect(adapter.waitForReceipt).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('preserves completed and partially submitted calls when a later receipt wait fails', async () => {
    const receiptOne = createReceipt(hashOne)
    const receiptFailure = new Error('Receipt RPC unavailable')
    const refresh = vi.fn().mockResolvedValue(undefined)
    const adapter = createAdapter({
      execute: vi.fn().mockResolvedValueOnce(hashOne).mockResolvedValueOnce(hashTwo),
      waitForReceipt: vi.fn().mockResolvedValueOnce(receiptOne).mockRejectedValueOnce(receiptFailure)
    })
    const plan = buildTransactionPlan({ intent: createIntent(2), connectedChainId: 1 })
    const error = await captureExecutionError({ account, adapter, plan, refresh })

    expect(error.cause).toBe(receiptFailure)
    expect(error.outcome).toEqual({
      submissions: [
        { stepId: 'deposit', chainId: 1, hash: hashOne, receipt: receiptOne },
        { stepId: 'stake', chainId: 1, hash: hashTwo }
      ]
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('fails safely when Safe tracking is not configured', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const plan = buildTransactionPlan({ intent: createIntent(), walletType: 'safe' })
    const error = await captureExecutionError({ account, adapter: createAdapter(), plan, refresh })

    expect(error.message).toContain('Safe batch execution and tracking')
    expect(error.outcome).toEqual({ submissions: [] })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('preserves confirmed submissions when refresh fails', async () => {
    const refreshFailure = new Error('Balance refresh failed')
    const receipt = createReceipt(hashOne)
    const states: VaultWidgetPlanExecutionState[] = []
    const plan = buildTransactionPlan({ intent: createIntent(), connectedChainId: 1 })
    const error = await captureExecutionError({
      account,
      adapter: createAdapter({ waitForReceipt: vi.fn().mockResolvedValue(receipt) }),
      plan,
      refresh: vi.fn().mockRejectedValue(refreshFailure),
      onState: (state) => states.push(state)
    })

    expect(error.cause).toBe(refreshFailure)
    expect(error.step).toMatchObject({ kind: 'refresh' })
    expect(error.outcome).toEqual({
      submissions: [{ stepId: 'deposit', chainId: 1, hash: hashOne, receipt }]
    })
    expect(states.map(({ status }) => status)).toEqual(['confirming', 'pending', 'refreshing', 'error'])
  })
})
