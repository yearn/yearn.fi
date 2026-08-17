import {
  executeTransactionPlan,
  type VaultWidgetExecutionAdapter,
  VaultWidgetPlanExecutionError,
  type VaultWidgetPlanExecutionState,
  type VaultWidgetPlanOutcome,
  type VaultWidgetTransactionPlan
} from '@yearn/vault-widget/headless'
import type {
  VaultWidgetNotificationId,
  VaultWidgetNotificationInput,
  VaultWidgetNotificationsRuntime
} from '@yearn/vault-widget/runtime'
import type { Address, Hash, TransactionReceipt } from 'viem'

export type TPlannedTransactionControllerState =
  | { status: 'confirming' }
  | { hash: Hash; status: 'pending' }
  | { hash: Hash; status: 'refreshing' }
  | { hash?: Hash; status: 'success' }
  | { error: Error; hash?: Hash; status: 'error' }
  | { error: Error; hash: Hash; status: 'submitted-unknown-error' }
  | { error: Error; hash: Hash; status: 'confirmed-refresh-error' }

export type TPlannedTransactionFailureKind = 'confirmed-refresh' | 'pre-submission' | 'submitted-unconfirmed'

export type TPlannedTransactionExecutionResult =
  | {
      hash?: Hash
      outcome: VaultWidgetPlanOutcome
      status: 'success'
    }
  | {
      error: Error
      hash?: Hash
      outcome: VaultWidgetPlanOutcome
      status: 'error'
      failureKind: TPlannedTransactionFailureKind
    }

export type TPlannedTransactionErrorPresentation = {
  actionLabel: 'Close' | 'Try Again'
  canRetry: boolean
  message: string
  title: string
}

export type TExecutePlannedStyledWidgetTransactionParams = {
  account: Address
  adapter: VaultWidgetExecutionAdapter
  notification?: VaultWidgetNotificationInput
  notificationExecutionChainId?: number
  notifications: Pick<VaultWidgetNotificationsRuntime, 'create' | 'update'>
  onNotificationError?: (error: unknown) => void
  onState?: (state: TPlannedTransactionControllerState) => void
  onTransactionConfirmed?: () => void
  plan: VaultWidgetTransactionPlan
  refresh: () => Promise<void>
}

type TNotificationQueue = {
  id?: Promise<VaultWidgetNotificationId | undefined>
  tail: Promise<void>
}

function getLatestHash(outcome: VaultWidgetPlanOutcome): Hash | undefined {
  return outcome.submissions.at(-1)?.hash
}

function getLatestReceipt(outcome: VaultWidgetPlanOutcome): TransactionReceipt | undefined {
  return outcome.submissions.at(-1)?.receipt
}

function isConfirmedRefreshFailure(error: Error): error is VaultWidgetPlanExecutionError {
  return (
    error instanceof VaultWidgetPlanExecutionError &&
    error.step.kind === 'refresh' &&
    error.outcome.submissions.some(({ receipt }) => receipt?.status === 'success')
  )
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Vault widget transaction execution failed')
}

export function getPlannedTransactionErrorPresentation(
  failureKind: TPlannedTransactionFailureKind,
  fallbackMessage = 'Transaction failed. Please try again.'
): TPlannedTransactionErrorPresentation {
  if (failureKind === 'confirmed-refresh') {
    return {
      actionLabel: 'Close',
      canRetry: false,
      message: 'Your transaction was confirmed, but balances could not be refreshed. Close this window and reload.',
      title: 'Transaction confirmed'
    }
  }

  if (failureKind === 'submitted-unconfirmed') {
    return {
      actionLabel: 'Close',
      canRetry: false,
      message:
        'Your transaction was submitted, but confirmation could not be verified. Check the block explorer before taking another action.',
      title: 'Transaction submitted'
    }
  }

  return {
    actionLabel: 'Try Again',
    canRetry: true,
    message: fallbackMessage,
    title: 'Transaction failed'
  }
}

/**
 * Runs a frozen one-call plan and bridges its lifecycle into the styled
 * widget's notification and UI contracts.
 */
export async function executePlannedStyledWidgetTransaction({
  account,
  adapter,
  notification,
  notificationExecutionChainId,
  notifications,
  onNotificationError = () => undefined,
  onState,
  onTransactionConfirmed,
  plan,
  refresh
}: TExecutePlannedStyledWidgetTransactionParams): Promise<TPlannedTransactionExecutionResult> {
  const notificationQueue: TNotificationQueue = { tail: Promise.resolve() }
  const confirmationState = { reported: false }

  const appendNotificationUpdate = (
    update: Omit<Parameters<VaultWidgetNotificationsRuntime['update']>[0], 'id'>
  ): void => {
    notificationQueue.tail = notificationQueue.tail
      .then(async () => {
        const id = await notificationQueue.id
        if (id === undefined) return
        await notifications.update({ ...update, id })
      })
      .catch(onNotificationError)
  }

  const createPendingNotification = (hash: Hash): void => {
    if (!notification || notificationQueue.id) return

    notificationQueue.id = notifications
      .create({
        ...notification,
        executionChainId: notificationExecutionChainId ?? notification.executionChainId
      })
      .catch((error: unknown) => {
        onNotificationError(error)
        return undefined
      })
    appendNotificationUpdate({ status: 'pending', txHash: hash })
  }

  const handleExecutionState = (state: VaultWidgetPlanExecutionState): void => {
    if (state.status === 'confirming') {
      onState?.({ status: 'confirming' })
      return
    }

    if (state.status === 'pending') {
      const hash = getLatestHash(state.outcome)
      if (!hash) return
      createPendingNotification(hash)
      onState?.({ hash, status: 'pending' })
      return
    }

    if (state.status === 'refreshing') {
      const hash = getLatestHash(state.outcome)
      if (!hash) return
      if (!confirmationState.reported) {
        confirmationState.reported = true
        onTransactionConfirmed?.()
      }
      appendNotificationUpdate({ receipt: getLatestReceipt(state.outcome), status: 'success' })
      onState?.({ hash, status: 'refreshing' })
      return
    }

    if (state.status === 'success') {
      onState?.({ hash: getLatestHash(state.outcome), status: 'success' })
    }
  }

  try {
    const outcome = await executeTransactionPlan({ account, adapter, plan, refresh, onState: handleExecutionState })
    await notificationQueue.tail
    return { hash: getLatestHash(outcome), outcome, status: 'success' }
  } catch (cause) {
    const error = normalizeError(cause)
    const outcome = error instanceof VaultWidgetPlanExecutionError ? error.outcome : { submissions: [] }
    const hash = getLatestHash(outcome)
    const transactionConfirmed = isConfirmedRefreshFailure(error)
    const submissionUnconfirmed = Boolean(hash && !getLatestReceipt(outcome))
    const failureKind: TPlannedTransactionFailureKind = transactionConfirmed
      ? 'confirmed-refresh'
      : submissionUnconfirmed
        ? 'submitted-unconfirmed'
        : 'pre-submission'

    if (failureKind === 'pre-submission') {
      const receipt = getLatestReceipt(outcome)
      appendNotificationUpdate({
        status: 'error',
        ...(hash ? { txHash: hash } : {}),
        ...(receipt ? { receipt } : {})
      })
    }
    if (transactionConfirmed && hash) {
      onState?.({ error, hash, status: 'confirmed-refresh-error' })
    } else if (submissionUnconfirmed && hash) {
      onState?.({ error, hash, status: 'submitted-unknown-error' })
    } else {
      onState?.({ error, hash, status: 'error' })
    }
    await notificationQueue.tail
    return { error, failureKind, hash, outcome, status: 'error' }
  }
}
