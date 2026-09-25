// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { buildTransactionPlan } from '@yearn/vault-widget/headless'
import { LifecycleTransactionOverlay } from '@yearn/vault-widget/internal/components/widget/shared/LifecycleTransactionOverlay'
import {
  createTransactionLifecycle,
  selectTransaction,
  type TTransactionPersistence,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { StrictMode } from 'react'
import type { TransactionReceipt } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-rewards', () => ({ useReward: () => ({ reward: () => undefined }) }))
const owner = '0x1111111111111111111111111111111111111111' as const
const hash = `0x${'a'.repeat(64)}` as const
const receipt = {
  transactionHash: hash,
  status: 'success',
  blockNumber: 1n,
  blockHash: `0x${'b'.repeat(64)}`
} as TransactionReceipt
const plan = buildTransactionPlan({
  connectedChainId: 1,
  intent: {
    id: 'deposit:10',
    mode: 'deposit',
    calls: [{ id: 'deposit', label: 'Deposit', request: { chainId: 1, to: owner, data: '0x1234' } }]
  }
})
const step = {
  id: 'deposit',
  label: 'Deposit',
  successTitle: 'Deposit successful',
  successMessage: 'Your deposit is complete.',
  confirmMessage: 'Confirm your deposit.',
  prepare: {
    isSuccess: true,
    isError: false,
    isLoading: false,
    isFetching: false,
    status: 'success' as const,
    data: { request: {} }
  }
}
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanup()
  cleanups.splice(0).forEach((cleanup) => {
    cleanup()
  })
})
function fixture(raw = false, persistence?: TTransactionPersistence) {
  const validate = vi.fn().mockResolvedValue(undefined)
  const legacyExecute = vi.fn().mockRejectedValue(new Error('Legacy raw executor must not run'))
  const gate: { resolve?: (value: { receipt: TransactionReceipt }) => void } = {}
  const execute = vi.fn().mockResolvedValue(hash)
  const wait = vi.fn(
    () =>
      new Promise<{ receipt: TransactionReceipt }>((resolve) => {
        gate.resolve = resolve
      })
  )
  const service = createTransactionLifecycle({
    execution: () => ({ execute, waitForReceipt: wait, switchChain: vi.fn() }),
    wallet: () => ({ address: owner, chainId: 1 }),
    executionChainId: () => 1,
    persistence
  })
  cleanups.push(service.connect())
  const done = vi.fn()
  const mount = (refresh?: () => Promise<void>) =>
    render(
      <StrictMode>
        <VaultWidgetRuntimeProvider
          value={{
            lifecycle: service,
            wallet: { address: owner, chainId: 1 },
            chains: { getChain: () => ({ id: 1, name: 'Ethereum', blockExplorerUrl: 'https://etherscan.io' }) }
          }}
        >
          <LifecycleTransactionOverlay
            isOpen
            plan={plan}
            step={
              raw
                ? {
                    ...step,
                    prepare: {
                      ...step.prepare,
                      kind: 'raw',
                      chainId: 1,
                      transaction: { chainId: 1, from: owner, to: owner, data: '0x1234', value: '0' },
                      validate,
                      execute: legacyExecute,
                      refetch: vi.fn(),
                      error: null
                    }
                  }
                : step
            }
            onClose={vi.fn()}
            onAllComplete={done}
            onBeforeSuccess={refresh}
          />
        </VaultWidgetRuntimeProvider>
      </StrictMode>
    )
  return { gate, execute, wait, service, done, mount, validate, legacyExecute }
}

describe('lifecycle overlay', () => {
  it.each([false, true])('uses one service observer through StrictMode and remount (raw Enso: %s)', async (raw) => {
    const f = fixture(raw)
    const first = f.mount()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(f.wait).toHaveBeenCalledTimes(1))
    first.unmount()
    f.mount()
    await act(async () => {
      f.gate.resolve?.({ receipt })
    })
    await screen.findByText('Deposit successful')
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.wait).toHaveBeenCalledTimes(1)
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.done).toHaveBeenCalledTimes(1)
    expect(f.validate).toHaveBeenCalledTimes(raw ? 1 : 0)
    expect(f.legacyExecute).not.toHaveBeenCalled()
    expect(screen.getByRole('link').getAttribute('href')).toBe(`https://etherscan.io/tx/${hash}`)
  })

  it('shows history recovery and retries loading before making a wallet request', async () => {
    const load = vi.fn().mockRejectedValue(new Error('offline'))
    const f = fixture(false, { load, apply: async (record) => record })
    f.mount()
    await screen.findByText('Transaction history is unavailable. Retrying before requesting your wallet.')
    expect(screen.queryByText('Confirm in your wallet')).toBeNull()
    expect(f.execute).not.toHaveBeenCalled()
    load.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
  })

  it('keeps success and offers only a refresh retry when balance refresh fails', async () => {
    const f = fixture()
    const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    f.mount(refresh)
    await waitFor(() => expect(f.wait).toHaveBeenCalledTimes(1))
    await act(async () => {
      f.gate.resolve?.({ receipt })
    })
    await screen.findByText('Deposit successful')
    expect(screen.queryByText('Try Again')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh balances' }))
    await waitFor(() => expect(f.service.getSnapshot().records[0].refresh).toBe('success'))
    expect(f.execute).toHaveBeenCalledTimes(1)
  })
})

describe('sequential lifecycle overlay', () => {
  it.each([false, true])('requires Continue after remount and retains conflicts (conflict: %s)', async (conflicted) => {
    const approvalHash = `0x${'c'.repeat(64)}` as const
    const pending: {
      approve?: (value: { receipt: TransactionReceipt }) => void
      deposit?: (value: { receipt: TransactionReceipt }) => void
    } = {}
    const execute = vi.fn().mockResolvedValueOnce(approvalHash).mockResolvedValue(hash)
    const onStepSuccess = vi.fn()
    const done = vi.fn()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const persisted: TTransactionRecord[] = []
    const service = createTransactionLifecycle({
      persistence: { load: async () => persisted, apply: async (record) => record },
      execution: () => ({
        execute,
        switchChain: vi.fn(),
        waitForReceipt: ({ hash }) =>
          new Promise((resolve) => {
            if (hash === approvalHash) pending.approve = resolve
            else pending.deposit = resolve
          })
      }),
      wallet: () => ({ address: owner, chainId: 1 }),
      executionChainId: () => 1
    })
    cleanups.push(service.connect())
    const sequence = buildTransactionPlan({
      connectedChainId: 1,
      intent: {
        ...plan.intent,
        approvals: [{ token: { address: owner, chainId: 1, symbol: 'Token' }, spender: owner, amount: 10n }]
      }
    })
    const approveStep = {
      ...step,
      id: 'approve',
      label: 'Approve',
      successTitle: 'Approval confirmed',
      confirmMessage: 'Approve Token'
    }
    const mount = () =>
      render(
        <StrictMode>
          <VaultWidgetRuntimeProvider value={{ lifecycle: service, wallet: { address: owner, chainId: 1 } }}>
            <LifecycleTransactionOverlay
              isOpen
              plan={sequence}
              step={approveStep}
              planSteps={{ 'approve-0': approveStep, deposit: step }}
              onStepSuccess={onStepSuccess}
              onAllComplete={done}
              onBeforeSuccess={refresh}
              onClose={vi.fn()}
            />
          </VaultWidgetRuntimeProvider>
        </StrictMode>
      )
    const first = mount()
    await screen.findByText('Step 1 of 2: Approve Token')
    await waitFor(() => expect(pending.approve).toBeDefined())
    first.unmount()
    await act(async () => pending.approve?.({ receipt: { ...receipt, transactionHash: approvalHash } }))
    mount()
    await screen.findByRole('button', { name: 'Continue' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
    expect(onStepSuccess).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.queryByText('Deposit successful')).toBeNull()
    if (conflicted) {
      persisted.push({ ...service.getSnapshot().records[0], conflict: 'Approval evidence is conflicting.' })
      await act(async () => service.recheckHistory())
      await screen.findByText('Confirmation needs review')
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
      expect(execute).toHaveBeenCalledTimes(1)
      expect(done).not.toHaveBeenCalled()
      return
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(pending.deposit).toBeDefined())
    expect(execute).toHaveBeenCalledTimes(2)
    await act(async () => pending.deposit?.({ receipt }))
    await screen.findByText('Deposit successful')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith('deposit')
    expect(onStepSuccess).toHaveBeenCalledExactlyOnceWith('deposit', receipt)
    expect(done).toHaveBeenCalledTimes(1)
  })
})
