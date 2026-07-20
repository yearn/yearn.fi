import {
  buildTransactionPlan,
  type VaultWidgetExecutionAdapter,
  type VaultWidgetTransactionIntent
} from '@yearn/vault-widget/headless'
import {
  executePlannedStyledWidgetTransaction,
  getPlannedTransactionErrorPresentation,
  type TPlannedTransactionControllerState
} from '@yearn/vault-widget/internal/components/widget/shared/plannedTransactionController'
import type { VaultWidgetNotificationsRuntime } from '@yearn/vault-widget/runtime'
import type { Hash, TransactionReceipt } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const account = '0x1111111111111111111111111111111111111111' as const
const hash = `0x${'1'.repeat(64)}` as Hash
const replacementHash = `0x${'2'.repeat(64)}` as Hash
const receipt = { status: 'success', transactionHash: hash } as TransactionReceipt
const notification = {
  amount: '10',
  fromAddress: account,
  fromChainId: 1,
  fromSymbol: 'USDC',
  type: 'deposit'
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const intent: VaultWidgetTransactionIntent = {
  id: 'deposit:direct:10',
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
    }
  ]
}

function createAdapter(overrides: Partial<VaultWidgetExecutionAdapter> = {}): VaultWidgetExecutionAdapter {
  return {
    execute: vi.fn().mockResolvedValue(hash),
    switchChain: vi.fn().mockResolvedValue(undefined),
    waitForReceipt: vi.fn().mockResolvedValue({ receipt }),
    ...overrides
  }
}

function createNotifications(): Pick<VaultWidgetNotificationsRuntime, 'createSubmitted' | 'update'> {
  return {
    createSubmitted: vi.fn().mockResolvedValue('notification-id'),
    update: vi.fn().mockResolvedValue(undefined)
  }
}

describe('executePlannedStyledWidgetTransaction', () => {
  it('does not let a fast receipt outrun durable notification creation', async () => {
    const createGate = createDeferred<'notification-id'>()
    const notifications = {
      createSubmitted: vi.fn().mockReturnValue(createGate.promise),
      update: vi.fn().mockResolvedValue(undefined)
    }
    const execution = executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter(),
      notification,
      notifications,
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh: vi.fn().mockResolvedValue(undefined)
    })

    await vi.waitFor(() => {
      expect(notifications.createSubmitted).toHaveBeenCalledWith({
        ...notification,
        executionChainId: undefined,
        ownerAddress: account,
        status: 'pending',
        txHash: hash
      })
    })
    expect(notifications.update).not.toHaveBeenCalled()

    createGate.resolve('notification-id')
    await expect(execution).resolves.toMatchObject({ status: 'success' })
    expect(notifications.update).toHaveBeenCalledWith({
      id: 'notification-id',
      receipt,
      status: 'success',
      txHash: hash
    })
  })

  it('reports notification persistence failure without retrying the submitted transaction', async () => {
    const persistenceError = new Error('IndexedDB unavailable')
    const onNotificationError = vi.fn()
    const notifications = {
      createSubmitted: vi.fn().mockRejectedValue(persistenceError),
      update: vi.fn().mockResolvedValue(undefined)
    }

    await expect(
      executePlannedStyledWidgetTransaction({
        account,
        adapter: createAdapter(),
        notification,
        notifications,
        onNotificationError,
        plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
        refresh: vi.fn().mockResolvedValue(undefined)
      })
    ).resolves.toMatchObject({ status: 'success' })

    expect(onNotificationError).toHaveBeenCalledWith(persistenceError)
    expect(notifications.update).not.toHaveBeenCalled()
  })

  it('preserves pending/success notifications, confirmation callback, refresh, and UI states', async () => {
    const states: TPlannedTransactionControllerState[] = []
    const notifications = createNotifications()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const onTransactionConfirmed = vi.fn()
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter(),
      notification,
      notificationExecutionChainId: 73571,
      notifications,
      onState: (state) => states.push(state),
      onTransactionConfirmed,
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh
    })

    expect(result).toMatchObject({ hash, status: 'success' })
    expect(states.map(({ status }) => status)).toEqual(['confirming', 'pending', 'refreshing', 'success'])
    expect(onTransactionConfirmed).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(notifications.createSubmitted).toHaveBeenCalledWith({
      ...notification,
      executionChainId: 73571,
      ownerAddress: account,
      status: 'pending',
      txHash: hash
    })
    expect(notifications.update).toHaveBeenCalledWith({
      id: 'notification-id',
      receipt,
      status: 'success',
      txHash: hash
    })
  })

  it('classifies refresh failure as confirmed and never marks the transaction retriable', async () => {
    const states: TPlannedTransactionControllerState[] = []
    const notifications = createNotifications()
    const adapter = createAdapter()
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter,
      notification,
      notifications,
      onState: (state) => states.push(state),
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh: vi.fn().mockRejectedValue(new Error('Balance refresh failed'))
    })

    expect(result).toMatchObject({ failureKind: 'confirmed-refresh', hash, status: 'error' })
    expect(states.map(({ status }) => status)).toEqual([
      'confirming',
      'pending',
      'refreshing',
      'confirmed-refresh-error'
    ])
    expect(adapter.execute).toHaveBeenCalledOnce()
    expect(notifications.update).toHaveBeenLastCalledWith({
      id: 'notification-id',
      receipt,
      status: 'success',
      txHash: hash
    })
    expect(getPlannedTransactionErrorPresentation('confirmed-refresh')).toMatchObject({
      actionLabel: 'Close',
      canRetry: false,
      title: 'Transaction confirmed'
    })
  })

  it('keeps a submitted transaction non-retriable when receipt verification is unknown', async () => {
    const notifications = createNotifications()
    const adapter = createAdapter({ waitForReceipt: vi.fn().mockRejectedValue(new Error('Receipt unavailable')) })
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter,
      notification,
      notifications,
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh: vi.fn().mockResolvedValue(undefined)
    })

    expect(result).toMatchObject({ failureKind: 'submitted-unconfirmed', hash, status: 'error' })
    expect(notifications.update).not.toHaveBeenCalled()
    expect(getPlannedTransactionErrorPresentation('submitted-unconfirmed', 'Receipt unavailable')).toEqual({
      actionLabel: 'Close',
      canRetry: false,
      message:
        'Your transaction was submitted, but confirmation could not be verified. Check the block explorer before taking another action.',
      title: 'Transaction submitted'
    })
  })

  it('marks a reverted receipt as failed and retriable without refreshing', async () => {
    const revertedReceipt = { ...receipt, status: 'reverted' } as TransactionReceipt
    const notifications = createNotifications()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const states: TPlannedTransactionControllerState[] = []
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter({ waitForReceipt: vi.fn().mockResolvedValue({ receipt: revertedReceipt }) }),
      notification,
      notifications,
      onState: (state) => states.push(state),
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh
    })

    expect(result).toMatchObject({
      failureKind: 'pre-submission',
      hash,
      outcome: { submissions: [{ hash, receipt: revertedReceipt }] },
      status: 'error'
    })
    expect(states.map(({ status }) => status)).toEqual(['confirming', 'pending', 'error'])
    expect(refresh).not.toHaveBeenCalled()
    expect(notifications.update).toHaveBeenCalledOnce()
    expect(notifications.update).toHaveBeenCalledWith({
      id: 'notification-id',
      receipt: revertedReceipt,
      status: 'error',
      txHash: hash
    })
    if (result.status !== 'error') throw new Error('Expected reverted transaction to fail')
    expect(getPlannedTransactionErrorPresentation(result.failureKind, result.error.message)).toEqual({
      actionLabel: 'Try Again',
      canRetry: true,
      message: 'Transaction reverted',
      title: 'Transaction failed'
    })
  })

  it('completes a speed-up under its mined replacement hash', async () => {
    const replacementReceipt = { ...receipt, transactionHash: replacementHash } as TransactionReceipt
    const notifications = createNotifications()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const states: TPlannedTransactionControllerState[] = []
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter({
        waitForReceipt: vi.fn().mockResolvedValue({
          receipt: replacementReceipt,
          replacement: { reason: 'repriced', replacedHash: hash }
        })
      }),
      notification,
      notifications,
      onState: (state) => states.push(state),
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh
    })

    expect(result).toMatchObject({
      hash: replacementHash,
      status: 'success'
    })
    expect(states).toMatchObject([
      { status: 'confirming' },
      { hash, status: 'pending' },
      { hash: replacementHash, status: 'refreshing' },
      { hash: replacementHash, status: 'success' }
    ])
    expect(refresh).toHaveBeenCalledOnce()
    expect(notifications.update).toHaveBeenCalledOnce()
    expect(notifications.update).toHaveBeenCalledWith({
      id: 'notification-id',
      receipt: replacementReceipt,
      status: 'success',
      txHash: replacementHash
    })
  })

  it('stops a mined wallet cancellation and exposes its replacement hash for retry', async () => {
    const cancellationReceipt = { ...receipt, transactionHash: replacementHash } as TransactionReceipt
    const notifications = createNotifications()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter({
        waitForReceipt: vi.fn().mockResolvedValue({
          receipt: cancellationReceipt,
          replacement: { reason: 'cancelled', replacedHash: hash }
        })
      }),
      notification,
      notifications,
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh
    })

    expect(result).toMatchObject({
      error: { message: 'Transaction was cancelled in the wallet' },
      failureKind: 'cancelled',
      hash: replacementHash,
      status: 'error'
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(notifications.update).toHaveBeenCalledOnce()
    expect(notifications.update).toHaveBeenCalledWith({
      id: 'notification-id',
      receipt: cancellationReceipt,
      status: 'error',
      txHash: replacementHash
    })
    expect(getPlannedTransactionErrorPresentation('cancelled')).toEqual({
      actionLabel: 'Try Again',
      canRetry: true,
      message: 'The transaction was cancelled in your wallet. You can try again.',
      title: 'Transaction cancelled'
    })
  })

  it('keeps failures before submission retriable', async () => {
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: createAdapter({ execute: vi.fn().mockRejectedValue(new Error('Wallet unavailable')) }),
      notification,
      notifications: createNotifications(),
      plan: buildTransactionPlan({ intent, connectedChainId: 1 }),
      refresh: vi.fn().mockResolvedValue(undefined)
    })

    expect(result).toMatchObject({ failureKind: 'pre-submission', status: 'error' })
    expect(getPlannedTransactionErrorPresentation('pre-submission', 'Wallet unavailable')).toEqual({
      actionLabel: 'Try Again',
      canRetry: true,
      message: 'Wallet unavailable',
      title: 'Transaction failed'
    })
  })
})
