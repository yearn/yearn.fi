'use client'

import {
  type ComponentType,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import type { Hash } from 'viem'
import type { VaultWidgetCopy, VaultWidgetExecutionState } from '../types'

export type VaultWidgetTransactionOverlayCopy = Pick<
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

export const DEFAULT_TRANSACTION_OVERLAY_COPY: VaultWidgetTransactionOverlayCopy = {
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
}

type TransactionLinkComponent = ComponentType<{
  chainId: number
  hash: Hash
  children: ReactNode
}>

export type VaultWidgetTransactionOverlayProps = {
  chainId: number
  copy?: Partial<VaultWidgetTransactionOverlayCopy>
  execution: VaultWidgetExecutionState
  onReset: () => void
  TransactionLink?: TransactionLinkComponent
}

type TransactionOverlayContent = {
  description: string
  title: string
}

type DisabledSiblingState = {
  ariaHidden: string | null
  hadInert: boolean
}

type OverlayPathEntry = {
  activeElement: HTMLElement
  parent: HTMLElement
}

function getOverlayPath(activeElement: HTMLElement, widget: HTMLElement): readonly OverlayPathEntry[] {
  if (activeElement === widget) return []
  const parent = activeElement.parentElement
  if (!parent) return []
  return [{ activeElement, parent }, ...getOverlayPath(parent, widget)]
}

function disableOverlaySiblings(dialog: HTMLElement): () => void {
  const widget = dialog.closest<HTMLElement>('.yv-widget')
  if (!widget) return () => undefined
  const disabledSiblings = new Map<HTMLElement, DisabledSiblingState>()
  const overlayPath = getOverlayPath(dialog, widget)
  const isolateSiblings = ({ activeElement, parent }: OverlayPathEntry): void => {
    Array.from(parent.children).forEach((child) => {
      if (!(child instanceof HTMLElement) || child === activeElement || disabledSiblings.has(child)) return
      disabledSiblings.set(child, {
        ariaHidden: child.getAttribute('aria-hidden'),
        hadInert: child.hasAttribute('inert')
      })
      child.setAttribute('inert', '')
      child.setAttribute('aria-hidden', 'true')
    })
  }
  overlayPath.forEach(isolateSiblings)
  const observers = overlayPath.map((entry) => {
    const observer = new MutationObserver(() => isolateSiblings(entry))
    observer.observe(entry.parent, { childList: true })
    return observer
  })

  return () => {
    observers.forEach((observer) => {
      observer.disconnect()
    })
    disabledSiblings.forEach(({ ariaHidden, hadInert }, element) => {
      element.toggleAttribute('inert', hadInert)
      if (ariaHidden === null) {
        element.removeAttribute('aria-hidden')
      } else {
        element.setAttribute('aria-hidden', ariaHidden)
      }
    })
  }
}

function getStepProgress(execution: Extract<VaultWidgetExecutionState, { step: unknown }>): string {
  return `${execution.step.label} (${execution.stepIndex + 1}/${execution.stepCount})`
}

export function getTransactionOverlayContent(
  execution: VaultWidgetExecutionState,
  copy: VaultWidgetTransactionOverlayCopy
): TransactionOverlayContent | undefined {
  if (execution.status === 'idle') return undefined
  if (execution.status === 'success') {
    return {
      description: copy.transactionConfirmed,
      title: copy.transactionComplete
    }
  }
  if (execution.status === 'error') {
    return {
      description: execution.error.message,
      title: copy.transactionFailed
    }
  }
  if (execution.status === 'submitted') {
    return {
      description: copy.waitingForDestination,
      title: copy.crossChainSubmitted
    }
  }
  if (execution.status === 'confirming') {
    if (execution.step.kind === 'refresh') {
      return {
        description: copy.updatingBalances,
        title: copy.transactionConfirmed
      }
    }
    return {
      description: getStepProgress(execution),
      title: execution.step.kind === 'safe-proposal' ? copy.confirmInSafe : copy.confirmInWallet
    }
  }
  if (execution.proposalId) {
    return {
      description: copy.safeProposalDescription,
      title: copy.safeProposalPending
    }
  }
  return {
    description: `${copy.waitingForConfirmation} ${getStepProgress(execution)}`,
    title: copy.transactionPending
  }
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

function SuccessIcon(): ReactElement {
  return (
    <svg className="yv-widget__transaction-icon" aria-hidden="true" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m14 24 7 7 14-15" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}

function ErrorIcon(): ReactElement {
  return (
    <svg className="yv-widget__transaction-icon" aria-hidden="true" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m17 17 14 14M31 17 17 31" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}

function isDismissible(execution: VaultWidgetExecutionState): boolean {
  return (
    execution.status === 'success' ||
    execution.status === 'error' ||
    execution.status === 'submitted' ||
    (execution.status === 'pending' && !!execution.proposalId)
  )
}

function getExecutionHash(execution: VaultWidgetExecutionState): Hash | undefined {
  if (execution.status === 'idle' || execution.status === 'confirming') return undefined
  if ('proposalId' in execution && execution.proposalId) return undefined
  return execution.hash
}

export function TransactionOverlay({
  chainId,
  copy,
  execution,
  onReset,
  TransactionLink
}: VaultWidgetTransactionOverlayProps): ReactElement | null {
  const [dismissed, setDismissed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const visible = execution.status !== 'idle' && !dismissed
  const dismissible = isDismissible(execution)

  useEffect(() => {
    if (execution.status === 'idle') setDismissed(false)
  }, [execution.status])

  useEffect(() => {
    if (!visible) return
    const dialog = dialogRef.current
    if (!dialog) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const restoreSiblings = disableOverlaySiblings(dialog)
    window.requestAnimationFrame(() => dialog.focus())
    return () => {
      restoreSiblings()
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus())
    }
  }, [visible])

  const resolvedCopy = { ...DEFAULT_TRANSACTION_OVERLAY_COPY, ...copy }
  const content = getTransactionOverlayContent(execution, resolvedCopy)
  if (!content) return null
  if (!visible) {
    return (
      <button
        className="yv-widget__transaction-resume"
        type="button"
        aria-label={`${resolvedCopy.viewTransactionStatus}: ${content.title}`}
        onClick={() => setDismissed(false)}
      >
        <span className="yv-widget__transaction-resume-indicator" aria-hidden="true" />
        <span>
          <strong>{content.title}</strong>
          <small>{resolvedCopy.viewTransactionStatus}</small>
        </span>
      </button>
    )
  }

  const close = (): void => {
    setDismissed(true)
    if (execution.status === 'success' || execution.status === 'error') onReset()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? []
    )
    if (controls.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  const hash = getExecutionHash(execution)

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live="polite"
      aria-modal="true"
      className="yv-widget__transaction-overlay"
      data-status={execution.status}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      {dismissible ? (
        <button
          className="yv-widget__transaction-close"
          type="button"
          aria-label={resolvedCopy.closeTransactionStatus}
          onClick={close}
        >
          <CloseIcon />
        </button>
      ) : null}
      <div className="yv-widget__transaction-content">
        {execution.status === 'success' ? (
          <SuccessIcon />
        ) : execution.status === 'error' ? (
          <ErrorIcon />
        ) : (
          <span className="yv-widget__transaction-spinner" aria-hidden="true" />
        )}
        <h3 id={titleId}>{content.title}</h3>
        <p id={descriptionId}>{content.description}</p>
        {hash ? (
          TransactionLink ? (
            <TransactionLink chainId={chainId} hash={hash}>
              {resolvedCopy.viewOnBlockExplorer}
            </TransactionLink>
          ) : (
            <span className="yv-widget__transaction-hash">
              {hash.slice(0, 6)}…{hash.slice(-4)}
            </span>
          )
        ) : null}
        {execution.status === 'success' || execution.status === 'error' ? (
          <button className="yv-widget__button yv-widget__button--primary" type="button" onClick={close}>
            {execution.status === 'success' ? resolvedCopy.done : resolvedCopy.tryAgain}
          </button>
        ) : null}
      </div>
    </div>
  )
}
