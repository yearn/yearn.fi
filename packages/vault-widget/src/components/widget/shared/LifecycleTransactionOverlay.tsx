import { Button } from '@yearn/vault-widget/internal/components/shared/Button'
import { getPreparationBridge } from '@yearn/vault-widget/internal/components/widget/shared/lifecyclePreparation'
import type { TransactionOverlayProps } from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import {
  AnimatedCheckmark,
  ErrorIcon,
  Spinner
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionStateIndicators'
import { selectTransaction } from '@yearn/vault-widget/lifecycle'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { isRawTransactionPreparation } from '@yearn/vault-widget/types'
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useReward } from 'react-rewards'

export function LifecycleTransactionOverlay(props: TransactionOverlayProps) {
  const runtime = useVaultWidgetRuntime()
  const service = runtime.lifecycle!
  const walletType = useRef(runtime.safe.isSafe)
  walletType.current = runtime.safe.isSafe
  const [reviewed] = useState(() => ({
    plan: props.plan
      ? structuredClone(props.plan)
      : {
          id: props.lifecycleRecipe!.id,
          walletType: runtime.safe.isSafe ? ('safe' as const) : ('eoa' as const),
          intent: { id: props.lifecycleRecipe!.id, mode: 'deposit' as const, calls: [] },
          steps: props.lifecycleRecipe!.steps.map((step) => ({
            ...step,
            kind: 'prepare' as const,
            chainId: props.lifecycleRecipe!.chainId
          }))
        },
    step: props.step,
    steps: props.planSteps,
    owner: props.reviewedOwner ?? runtime.wallet.address,
    commandId: crypto.randomUUID()
  }))
  const [bridge] = useState(() =>
    props.lifecycleRecipe && reviewed.owner
      ? getPreparationBridge(service, reviewed.owner, props.lifecycleRecipe)
      : undefined
  )
  // Synchronize route preparations at React commit boundaries. The service remains the only runner.
  useLayoutEffect(() => {
    if (!bridge || !props.lifecycleRecipe) return
    bridge.attach({
      canonicalChainId: runtime.chains.resolveCanonicalChainId,
      id: reviewed.commandId,
      props,
      owner: runtime.wallet.address,
      isSafe: runtime.safe.isSafe,
      recipe: props.lifecycleRecipe
    })
  })
  // Unmount detaches preparation only; accepted wallet submissions remain with the service.
  useEffect(() => () => bridge?.detach(reviewed.commandId), [bridge, reviewed])
  const [flowId, setFlowId] = useState<string>(reviewed.commandId)
  const activeId = useRef<string>(reviewed.commandId)
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  const flow = state.flows.find((item) => item.id === flowId)
  const record = state.records.find((item) => item.id === flow?.recordId)
  const view = record ? selectTransaction(record) : undefined
  const step =
    bridge?.prepared.get(flow?.stepId ?? '') ??
    reviewed.steps?.[flow?.stepId ?? reviewed.plan.steps[0]?.id] ??
    props.step ??
    reviewed.step
  const finalStepId = props.lifecycleRecipe
    ? (reviewed.plan.steps.at(-1)?.id ?? '')
    : (reviewed.plan.intent.calls.at(-1)?.id ?? '')
  const finalStep = bridge?.prepared.get(finalStepId) ?? reviewed.steps?.[finalStepId] ?? reviewed.step
  const isFinalRecord = !record?.sequence || record.sequence.index === record.sequence.count - 1
  const success = view?.outcome === 'success' && isFinalRecord
  const isPaused = flow?.phase === 'paused' && (!record || view?.outcome === 'success')
  const needsReview = Boolean(
    record?.source && view?.outcome === 'success' && !isFinalRecord && flow?.phase === 'pending'
  )
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
    const call = reviewed.plan.intent.calls[0]?.request
    const id = service.start({
      commandId: reviewed.commandId,
      owner: reviewed.owner,
      plan: reviewed.plan,
      display: finalStep?.notification,
      displayByStep: reviewed.steps
        ? Object.fromEntries(Object.entries(reviewed.steps).map(([id, step]) => [id, step.notification]))
        : undefined,
      describeStep: bridge ? (id) => bridge.prepared.get(id)?.notification : undefined,
      prepareStep: bridge?.prepareStep,
      afterStep: bridge?.afterStep,
      authorize: () => {
        if (walletType.current !== (reviewed.plan.walletType === 'safe'))
          throw new Error('Wallet type changed. Close and review again.')
        bridge?.authorize()
      },
      validate:
        raw && call && !bridge
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
      refresh: props.onBeforeSuccess ? () => props.onBeforeSuccess!(finalStepId || reviewed.step?.id || '') : undefined
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
    if (service.claimEffect(flowId, 'step'))
      void callbacks.current.onStepSuccess?.(finalStep?.id ?? '', record?.source?.receipt)
    if (finalStep?.showConfetti && service.claimEffect(flowId, 'confetti')) reward()
    if (!props.deferOnAllCompleteUntilClose && (!props.deferOnAllCompleteUntilConfettiEnd || !finalStep?.showConfetti))
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
  const explorer =
    chain?.blockExplorerUrl && view?.reference.hash ? `${chain.blockExplorerUrl}/tx/${view.reference.hash}` : undefined
  const close = (): void => {
    if (success) complete()
    service.pause(flowId)
    props.onClose()
  }
  const unresolved = view?.outcome === 'unknown' || flow?.phase === 'unknown'
  const failed = view?.outcome === 'error' || flow?.phase === 'blocked' || flow?.phase === 'rejected'
  const recovering = !record && (!flow || flow.phase === 'confirming') && state.history !== 'ready'
  const title =
    isPaused || needsReview
      ? 'Ready for the next step'
      : recovering
        ? 'Checking transaction history'
        : success
          ? refreshing
            ? 'Transaction confirmed'
            : (finalStep?.successTitle ?? 'Transaction confirmed')
          : ((flow?.phase === 'confirming' ? undefined : view?.label) ??
            (flow?.phase === 'rejected'
              ? 'Transaction cancelled'
              : flow?.phase === 'blocked'
                ? 'Review transaction'
                : unresolved
                  ? 'Check your wallet'
                  : 'Confirm in your wallet'))
  const detail = isPaused
    ? flow?.error
    : needsReview
      ? 'This transaction confirmed. Close and review the remaining action to continue.'
      : recovering
        ? state.history === 'unavailable'
          ? 'Transaction history is unavailable. Retrying before requesting your wallet.'
          : 'Checking for unfinished transactions before requesting your wallet.'
        : success
          ? refreshing
            ? 'Updating balances...'
            : finalStep?.successMessage
          : (view?.detail ?? flow?.error ?? (record ? 'Waiting for confirmation...' : step?.confirmMessage))
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
        {(flow?.stepCount ?? 1) > 1 ? (
          <p className="mt-4 text-sm text-text-secondary">
            Step {(flow?.stepIndex ?? 0) + 1} of {flow?.stepCount}: {flow?.stepLabel}
          </p>
        ) : null}
        <h3 className="mb-2 mt-6 text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mb-4 whitespace-pre-line text-sm text-text-secondary">{detail}</p>
        {record?.storageError ? <p className="mb-4 text-sm text-text-secondary">{record.storageError}</p> : null}
        {record?.refreshError ? <p className="mb-4 text-sm text-text-secondary">{record.refreshError}</p> : null}
        {recovering && state.history === 'unavailable' ? (
          <Button className="mb-3 w-full max-w-xs" onClick={() => service.recheckHistory()}>
            Retry history
          </Button>
        ) : null}
        {explorer ? (
          <a className="mb-4 text-sm font-semibold underline" href={explorer} target="_blank" rel="noopener noreferrer">
            View on block explorer
          </a>
        ) : null}
        {isPaused ? (
          <Button className="mb-3 w-full max-w-xs" onClick={() => service.continue(flowId)}>
            Continue
          </Button>
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
        {(success && !refreshing) ||
        failed ||
        unresolved ||
        isPaused ||
        needsReview ||
        (record?.safe && !record.source) ? (
          <Button className="w-full max-w-xs" classNameOverride="yearn--button--nextgen w-full" onClick={close}>
            {success ? 'Done' : 'Close'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
