export type TPlannedTransactionFailureKind =
  | 'cancelled'
  | 'confirmed-refresh'
  | 'pre-submission'
  | 'replaced'
  | 'submitted-unconfirmed'

export type TPlannedTransactionErrorPresentation = {
  actionLabel: 'Close' | 'Try Again'
  canRetry: boolean
  message: string
  title: string
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

  if (failureKind === 'cancelled') {
    return {
      actionLabel: 'Try Again',
      canRetry: true,
      message: 'The transaction was cancelled in your wallet. You can try again.',
      title: 'Transaction cancelled'
    }
  }

  if (failureKind === 'replaced') {
    return {
      actionLabel: 'Close',
      canRetry: false,
      message: 'This transaction was replaced by a different wallet transaction. Close this window and try again.',
      title: 'Transaction replaced'
    }
  }

  return {
    actionLabel: 'Try Again',
    canRetry: true,
    message: fallbackMessage,
    title: 'Transaction failed'
  }
}
