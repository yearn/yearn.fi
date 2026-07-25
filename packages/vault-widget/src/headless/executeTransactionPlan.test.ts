import { describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import type { VaultWidgetTransactionPlan } from '../types'
import { executeVaultWidgetPlan } from './executeTransactionPlan'

const { switchChainMock } = vi.hoisted(() => ({
  switchChainMock: vi.fn()
}))

vi.mock('wagmi/actions', () => ({
  switchChain: switchChainMock
}))

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
  it('switches chains before execution and refreshes only after confirmation', async () => {
    const events: string[] = []
    switchChainMock.mockImplementation(async () => {
      events.push('switch')
    })
    const chainPlan: VaultWidgetTransactionPlan = {
      ...plan,
      steps: [
        { id: 'switch', kind: 'switch-chain', label: 'Switch chain', chainId: 1 },
        { id: 'execute', kind: 'execute', label: 'Claim', chainId: 1, request },
        { id: 'refresh', kind: 'refresh', label: 'Refresh balances' }
      ]
    }

    await executeVaultWidgetPlan({
      account,
      config: {} as Config,
      execution: {
        execute: vi.fn(async () => {
          events.push('execute')
          return hash
        }),
        waitForReceipt: vi.fn(async () => {
          events.push('receipt')
        })
      },
      onExecution: vi.fn(),
      onRefresh: vi.fn(async () => {
        events.push('refresh')
      }),
      plan: chainPlan
    })

    expect(switchChainMock).toHaveBeenCalledWith(expect.anything(), { chainId: 1 })
    expect(events).toEqual(['switch', 'execute', 'receipt', 'refresh'])
  })

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

  it('rejects receiptless Safe completion without associating a prior transaction hash', async () => {
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

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: {
          execute: vi.fn().mockResolvedValue(hash),
          proposeSafeBatch: vi.fn().mockResolvedValue(proposalId),
          waitForReceipt: vi.fn().mockResolvedValue(undefined),
          waitForSafeExecution: vi.fn().mockResolvedValue(undefined)
        },
        onExecution: vi.fn(),
        onProgress,
        onRefresh: vi.fn().mockResolvedValue(undefined),
        plan: safePlan
      })
    ).rejects.toThrow('without a transaction receipt')

    const safeProgress = onProgress.mock.calls[1]?.[0]
    expect(safeProgress).toMatchObject({ isFinalTransaction: true, proposalId })
    expect(safeProgress).not.toHaveProperty('hash')
  })

  it('does not propose a Safe batch when execution tracking is unavailable', async () => {
    const proposeSafeBatch = vi.fn().mockResolvedValue('0x1234')
    const safePlan: VaultWidgetTransactionPlan = {
      ...plan,
      walletType: 'safe',
      steps: [{ id: 'safe', kind: 'safe-proposal', label: 'Propose batch', chainId: 1, requests: [request] }]
    }

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: {
          execute: vi.fn(),
          proposeSafeBatch,
          waitForReceipt: vi.fn()
        },
        onExecution: vi.fn(),
        onRefresh: vi.fn(),
        plan: safePlan
      })
    ).rejects.toThrow('execution and tracking')
    expect(proposeSafeBatch).not.toHaveBeenCalled()
  })

  it('surfaces wallet rejection without confirming or refreshing', async () => {
    const rejection = new Error('User rejected the request')
    const onRefresh = vi.fn()
    const waitForReceipt = vi.fn()

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: {
          execute: vi.fn().mockRejectedValue(rejection),
          waitForReceipt
        },
        onExecution: vi.fn(),
        onRefresh,
        plan
      })
    ).rejects.toBe(rejection)
    expect(waitForReceipt).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('surfaces a reverted receipt without refreshing balances', async () => {
    const revert = new Error('Transaction reverted')
    const onProgress = vi.fn()
    const onRefresh = vi.fn()

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        execution: {
          execute: vi.fn().mockResolvedValue(hash),
          waitForReceipt: vi.fn().mockRejectedValue(revert)
        },
        onExecution: vi.fn(),
        onProgress,
        onRefresh,
        plan
      })
    ).rejects.toBe(revert)
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ hash, isFinalTransaction: true }))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('tracks delayed Safe execution through cross-chain completion before refresh', async () => {
    const proposalId = '0x1234' as const
    const destinationHash = `0x${'66'.repeat(32)}` as const
    const order: string[] = []
    const onEvent = vi.fn()
    const safeBridgePlan: VaultWidgetTransactionPlan = {
      ...plan,
      walletType: 'safe',
      quote: {
        ...plan.quote,
        bridge: {
          destinationChainId: 10,
          protocol: 'relay',
          sourceChainId: 1
        }
      },
      steps: [
        { id: 'safe', kind: 'safe-proposal', label: 'Propose batch', chainId: 1, requests: [request] },
        {
          id: 'bridge',
          kind: 'wait-cross-chain',
          label: 'Complete bridge',
          bridge: {
            destinationChainId: 10,
            protocol: 'relay',
            sourceChainId: 1
          }
        },
        { id: 'refresh', kind: 'refresh', label: 'Refresh balances' }
      ]
    }

    await expect(
      executeVaultWidgetPlan({
        account,
        config: {} as Config,
        ensoBridge: {
          waitForCompletion: vi.fn(async (_bridge, onStatus) => {
            order.push('bridge')
            const status = {
              destinationChainId: 10,
              destinationTxHash: destinationHash,
              sourceChainId: 1,
              sourceTxHash: hash,
              status: 'delivered' as const
            }
            onStatus?.(status)
            return status
          })
        },
        execution: {
          execute: vi.fn(),
          proposeSafeBatch: vi.fn(async () => {
            order.push('propose')
            return proposalId
          }),
          waitForReceipt: vi.fn(),
          waitForSafeExecution: vi.fn(async () => {
            order.push('safe-executed')
            return hash
          })
        },
        onEvent,
        onExecution: vi.fn(),
        onRefresh: vi.fn(async () => {
          order.push('refresh')
        }),
        onSubmitted: vi.fn(async () => {
          order.push('submitted')
        }),
        plan: safeBridgePlan
      })
    ).resolves.toEqual({ destinationHash, hash, proposalId })

    expect(order).toEqual(['propose', 'safe-executed', 'submitted', 'bridge', 'refresh'])
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bridge_status',
        status: expect.objectContaining({ status: 'delivered', destinationTxHash: destinationHash })
      })
    )
  })
})
