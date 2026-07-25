// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultWidgetCopy, VaultWidgetExecutionState } from '../types'
import { getTransactionOverlayContent, TransactionOverlay } from './TransactionOverlay'

const copy = {
  confirmInWallet: 'Confirm in your wallet',
  confirmInSafe: 'Confirm the proposal in Safe',
  transactionConfirmed: 'Your transaction was confirmed.',
  transactionPending: 'Transaction pending',
  safeProposalPending: 'Transaction submitted',
  safeProposalDescription: 'Execution may happen separately after the required Safe confirmations are collected.',
  crossChainSubmitted: 'Cross-chain transaction submitted',
  waitingForConfirmation: 'Waiting for confirmation.',
  waitingForDestination: 'Waiting for destination-chain completion.',
  updatingBalances: 'Updating balances…',
  transactionComplete: 'Transaction complete',
  transactionFailed: 'Transaction failed',
  done: 'Done',
  tryAgain: 'Try again',
  viewTransactionStatus: 'View transaction status',
  viewOnBlockExplorer: 'View on block explorer',
  closeTransactionStatus: 'Close transaction status'
} satisfies Pick<
  VaultWidgetCopy,
  | 'confirmInWallet'
  | 'confirmInSafe'
  | 'transactionConfirmed'
  | 'transactionPending'
  | 'safeProposalPending'
  | 'safeProposalDescription'
  | 'crossChainSubmitted'
  | 'waitingForConfirmation'
  | 'waitingForDestination'
  | 'updatingBalances'
  | 'transactionComplete'
  | 'transactionFailed'
  | 'done'
  | 'tryAgain'
  | 'viewTransactionStatus'
  | 'viewOnBlockExplorer'
  | 'closeTransactionStatus'
>

const step = {
  id: 'deposit',
  kind: 'execute',
  label: 'Deposit assets'
} as const

function renderOverlay(execution: VaultWidgetExecutionState, onReset = vi.fn()): ReturnType<typeof render> {
  function TransactionLink({ hash, children }: { chainId: number; hash: `0x${string}`; children: ReactNode }) {
    return <a href={`https://example.test/tx/${hash}`}>{children}</a>
  }

  return render(
    <div className="yv-widget">
      <button type="button">Submit transaction</button>
      <TransactionOverlay
        chainId={1}
        copy={copy}
        execution={execution}
        onReset={onReset}
        TransactionLink={TransactionLink}
      />
    </div>
  )
}

describe('TransactionOverlay', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('maps wallet, Safe, refresh, pending, and bridge steps to distinct content', () => {
    expect(getTransactionOverlayContent({ status: 'confirming', step, stepCount: 2, stepIndex: 0 }, copy)).toEqual({
      description: 'Deposit assets (1/2)',
      title: 'Confirm in your wallet'
    })
    expect(
      getTransactionOverlayContent(
        {
          status: 'confirming',
          step: { ...step, kind: 'safe-proposal' },
          stepCount: 1,
          stepIndex: 0
        },
        copy
      )?.title
    ).toBe('Confirm the proposal in Safe')
    expect(
      getTransactionOverlayContent(
        {
          status: 'confirming',
          step: { ...step, kind: 'refresh' },
          stepCount: 2,
          stepIndex: 1
        },
        copy
      )
    ).toEqual({
      description: 'Updating balances…',
      title: 'Your transaction was confirmed.'
    })
    expect(
      getTransactionOverlayContent(
        {
          status: 'pending',
          step,
          stepCount: 2,
          stepIndex: 0
        },
        copy
      )
    ).toEqual({
      description: 'Waiting for confirmation. Deposit assets (1/2)',
      title: 'Transaction pending'
    })
    expect(
      getTransactionOverlayContent(
        {
          status: 'submitted',
          step: { ...step, kind: 'wait-cross-chain' },
          stepCount: 2,
          stepIndex: 1,
          hash: '0x1111111111111111111111111111111111111111111111111111111111111111'
        },
        copy
      )
    ).toEqual({
      description: 'Waiting for destination-chain completion.',
      title: 'Cross-chain transaction submitted'
    })
  })

  it('traps focus while wallet confirmation cannot be dismissed', () => {
    renderOverlay({ status: 'confirming', step, stepCount: 1, stepIndex: 0 })

    const dialog = screen.getByRole('dialog', { name: 'Confirm in your wallet' })
    expect(screen.getByText('Submit transaction').closest('button')?.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('lets a Safe proposal continue tracking after its overlay is dismissed', () => {
    const onReset = vi.fn()
    renderOverlay(
      {
        status: 'pending',
        step: { ...step, kind: 'safe-proposal' },
        stepCount: 1,
        stepIndex: 0,
        proposalId: '0x1234'
      },
      onReset
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close transaction status' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Submit transaction' }).hasAttribute('inert')).toBe(false)
    expect(onReset).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'View transaction status: Transaction submitted'
      })
    )
    expect(screen.getByRole('dialog', { name: 'Transaction submitted' })).toBeTruthy()
  })

  it('uses the transaction-link slot and resets retryable failures', () => {
    const hash = '0x2222222222222222222222222222222222222222222222222222222222222222'
    const onReset = vi.fn()
    const view = renderOverlay(
      {
        status: 'pending',
        step,
        stepCount: 1,
        stepIndex: 0,
        hash
      },
      onReset
    )

    expect(screen.getByRole('link', { name: 'View on block explorer' }).getAttribute('href')).toContain(hash)
    view.rerender(
      <div className="yv-widget">
        <TransactionOverlay
          chainId={1}
          copy={copy}
          execution={{ status: 'error', error: new Error('Transaction reverted') }}
          onReset={onReset}
        />
      </div>
    )
    expect(screen.getByRole('dialog', { name: 'Transaction failed' }).textContent).toContain('Transaction reverted')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
