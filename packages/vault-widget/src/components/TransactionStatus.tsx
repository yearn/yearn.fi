import type { ReactElement } from 'react'
import type { VaultWidgetExecutionState } from '../types'

export function TransactionStatus({ execution }: { execution: VaultWidgetExecutionState }): ReactElement | null {
  if (execution.status === 'idle') return null
  if (execution.status === 'success') {
    return (
      <div className="yv-widget__notice yv-widget__notice--success" role="status">
        Transaction complete.
      </div>
    )
  }
  if (execution.status === 'error') {
    return (
      <div className="yv-widget__notice yv-widget__notice--error" role="alert">
        {execution.error.message}
      </div>
    )
  }
  if (execution.status === 'submitted') {
    return (
      <div className="yv-widget__notice" role="status" aria-live="polite">
        <span className="yv-widget__spinner" aria-hidden="true" />
        <span>
          Cross-chain transaction submitted
          <small>Waiting for destination-chain completion</small>
        </span>
      </div>
    )
  }
  return (
    <div className="yv-widget__notice" role="status" aria-live="polite">
      <span className="yv-widget__spinner" aria-hidden="true" />
      <span>
        {execution.status === 'confirming'
          ? execution.step.kind === 'refresh'
            ? 'Refreshing balances'
            : execution.step.kind === 'safe-proposal'
              ? 'Confirm the proposal in Safe'
              : 'Confirm in your wallet'
          : execution.proposalId
            ? 'Safe proposal pending'
            : 'Transaction pending'}
        <small>
          {execution.step.label} ({execution.stepIndex + 1}/{execution.stepCount})
        </small>
      </span>
    </div>
  )
}
