import { Button } from '@yearn/vault-widget/internal/components/shared/Button'
import type { TransactionOverlayProps } from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import {
  AnimatedCheckmark,
  ErrorIcon,
  Spinner
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionStateIndicators'
import { selectTransaction } from '@yearn/vault-widget/lifecycle'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { isRawTransactionPreparation } from '@yearn/vault-widget/types'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useReward } from 'react-rewards'

export function LifecycleTransactionOverlay(props: TransactionOverlayProps) {
  const runtime = useVaultWidgetRuntime()
  const service = runtime.lifecycle!
  const [reviewed] = useState(() => ({
    plan: structuredClone(props.plan!),
    step: props.step,
    owner: runtime.wallet.address,
    commandId: crypto.randomUUID()
  }))
  const [flowId, setFlowId] = useState<string>(reviewed.commandId)
  const activeId = useRef<string>(reviewed.commandId)
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  const flow = state.flows.find((item) => item.id === flowId)
  const record = state.records.find((item) => item.id === flow?.recordId)
  const view = record ? selectTransaction(record) : undefined
  const success = view?.outcome === 'success'
  const refreshing = success && (record?.refresh === 'idle' || record?.refresh === 'pending')
  const callbacks = useRef(props)
  callbacks.current = props
  const confettiId = `lifecycle-${useId().replace(/:/g, '')}`
  const complete = (): void => {
    if (
      success &&
      runtime.wallet.address?.toLowerCase() === reviewed.owner?.toLowerCase() &&
      service.claimEffect(flowId, 'complete')
    )
      callbacks.current.onAllComplete?.()
  }
  const { reward } = useReward(confettiId, 'confetti', {
    elementCount: 80,
    spread: 90,
    onAnimationComplete: () => {
      if (callbacks.current.deferOnAllCompleteUntilConfettiEnd) complete()
    }
  })

  // Start one reviewed command. The provider retains its wallet result and observer after this view unmounts.
  useEffect(() => {
    if (!props.isOpen || !reviewed.owner) return
    const preparation = reviewed.step?.prepare
    const raw = isRawTransactionPreparation(preparation) ? preparation : undefined
    const call = reviewed.plan.intent.calls[0].request
    const id = service.start({
      commandId: reviewed.commandId,
      owner: reviewed.owner,
      plan: reviewed.plan,
      display: reviewed.step?.notification,
      validate: raw
        ? async () => {
            if (
              !raw.validate ||
              !raw.transaction ||
              raw.transaction.from.toLowerCase() !== reviewed.owner!.toLowerCase()
            )
              throw new Error('Quote owner changed. Close and review the transaction again.')
            await raw.validate({
              ...raw.transaction,
              chainId: call.chainId,
              to: call.to,
              data: call.data,
              value: (call.value ?? 0n).toString()
            })
          }
        : undefined,
      refresh: props.onBeforeSuccess ? () => props.onBeforeSuccess!(reviewed.step?.id ?? '') : undefined
    })
    activeId.current = id
    setFlowId(id)
    return () => service.pause(activeId.current)
  }, [props.isOpen, reviewed, service])

  // Completion callbacks/animation are view effects only; the shared selector already establishes success.
  useEffect(() => {
    if (
      !props.isOpen ||
      !success ||
      refreshing ||
      runtime.wallet.address?.toLowerCase() !== reviewed.owner?.toLowerCase()
    )
      return
    if (service.claimEffect(flowId, 'step')) void callbacks.current.onStepSuccess?.(reviewed.step?.id ?? '')
    if (reviewed.step?.showConfetti && service.claimEffect(flowId, 'confetti')) reward()
    if (
      !props.deferOnAllCompleteUntilClose &&
      (!props.deferOnAllCompleteUntilConfettiEnd || !reviewed.step?.showConfetti)
    )
      complete()
  }, [
    success,
    refreshing,
    props.isOpen,
    runtime.wallet.address,
    flowId,
    service,
    reviewed,
    reward,
    props.deferOnAllCompleteUntilClose,
    props.deferOnAllCompleteUntilConfettiEnd
  ])

  if (!props.isOpen) return null
  const chain = view ? runtime.chains.getChain(view.reference.executionChainId) : undefined
  const explorer = chain?.blockExplorerUrl && view ? `${chain.blockExplorerUrl}/tx/${view.reference.hash}` : undefined
  const close = (): void => {
    if (success) complete()
    service.pause(flowId)
    props.onClose()
  }
  const unresolved = view?.outcome === 'unknown' || flow?.phase === 'unknown'
  const failed = view?.outcome === 'error' || flow?.phase === 'blocked' || flow?.phase === 'rejected'
  const title = success
    ? refreshing
      ? 'Transaction confirmed'
      : (reviewed.step?.successTitle ?? 'Transaction confirmed')
    : (view?.label ??
      (flow?.phase === 'rejected'
        ? 'Transaction cancelled'
        : flow?.phase === 'blocked'
          ? 'Review transaction'
          : unresolved
            ? 'Check your wallet'
            : 'Confirm in your wallet'))
  const detail = success
    ? refreshing
      ? 'Updating balances...'
      : reviewed.step?.successMessage
    : (view?.detail ?? flow?.error ?? (view ? 'Waiting for confirmation...' : reviewed.step?.confirmMessage))
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col rounded-lg bg-surface p-6 text-center"
      role="dialog"
      aria-label="Transaction progress"
    >
      <button
        type="button"
        aria-label="Close transaction progress"
        onClick={close}
        className="absolute right-4 top-4 p-1 text-text-secondary"
      >
        ✕
      </button>
      <div
        className={`flex flex-1 flex-col items-center ${props.contentAlign === 'start' ? 'pt-8' : 'justify-center'}`}
      >
        <span id={confettiId} />
        {success && !refreshing ? <AnimatedCheckmark isVisible /> : failed ? <ErrorIcon /> : <Spinner />}
        <h3 className="mb-2 mt-6 text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mb-4 whitespace-pre-line text-sm text-text-secondary">{detail}</p>
        {record?.storageError ? <p className="mb-4 text-sm text-text-secondary">{record.storageError}</p> : null}
        {record?.refreshError ? <p className="mb-4 text-sm text-text-secondary">{record.refreshError}</p> : null}
        {explorer ? (
          <a className="mb-4 text-sm font-semibold underline" href={explorer} target="_blank" rel="noopener noreferrer">
            View on block explorer
          </a>
        ) : null}
        {record?.refresh === 'error' ? (
          <Button className="mb-3 w-full max-w-xs" onClick={() => service.refresh(record.id)}>
            Refresh balances
          </Button>
        ) : null}
        {unresolved && record && !record.source ? (
          <Button className="mb-3 w-full max-w-xs" onClick={() => service.recheck(record.id)}>
            Recheck confirmation
          </Button>
        ) : null}
        {(success && !refreshing) || failed || unresolved ? (
          <Button className="w-full max-w-xs" classNameOverride="yearn--button--nextgen w-full" onClick={close}>
            {success ? 'Done' : 'Close'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
