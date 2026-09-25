import {
  awaitTransactionRefresh,
  type ExecuteTransactionPlanParams,
  executeTransactionPlan,
  getTransactionConfirmations,
  type TPreparedStep,
  type VaultWidgetExecutionAdapter,
  VaultWidgetPreparationError,
  type VaultWidgetTransactionPlan,
  type VaultWidgetTransactionReceiptResult
} from '@yearn/vault-widget/headless'
import {
  hasSuccessfulSourceReceipt,
  reduceTransaction,
  selectTransaction,
  type TTransactionObservation,
  type TTransactionPersistence,
  type TTransactionRecord,
  transactionIdentity
} from '@yearn/vault-widget/lifecycle/model'
import {
  isSettlementRequirement,
  settlementOutcome,
  type TSettlementEvidence,
  type TSettlementRequirement
} from '@yearn/vault-widget/lifecycle/settlement'
import type { VaultWidgetNotificationInput } from '@yearn/vault-widget/runtime'
import type { Address } from 'viem'

export type TTransactionFlow = {
  id: string
  owner: Address
  intentKey: string
  phase: 'confirming' | 'pending' | 'paused' | 'success' | 'rejected' | 'blocked' | 'unknown'
  recordId?: string
  stepId?: string
  stepIndex?: number
  stepCount?: number
  stepLabel?: string
  executionChainId?: number
  error?: string
}
export type TLifecycleSnapshot = {
  records: readonly TTransactionRecord[]
  flows: readonly TTransactionFlow[]
  history: 'loading' | 'ready' | 'unavailable'
}
export type TStartTransaction = {
  commandId: string
  owner: Address
  plan: VaultWidgetTransactionPlan
  /** Read/lock compatibility only; new records always use plan.intent.id. */
  previousIntentIds?: readonly string[]
  display?: VaultWidgetNotificationInput
  describeStep?: (stepId: string) => VaultWidgetNotificationInput | undefined
  displayByStep?: Readonly<Record<string, VaultWidgetNotificationInput | undefined>>
  prepareStep?: ExecuteTransactionPlanParams['prepareStep']
  afterStep?: ExecuteTransactionPlanParams['afterStep']
  validate?: () => Promise<void>
  authorize?: () => void
  refresh?: () => Promise<void>
  settlement?: TSettlementRequirement
  describeSettlement?: (stepId: string) => TSettlementRequirement | undefined
}
export type TLifecycleOptions = {
  execution: () => VaultWidgetExecutionAdapter
  executionChainId: (chainId: number) => number | undefined
  wallet: () => { address?: Address; chainId?: number }
  refresh?: (record: TTransactionRecord, milestone?: 'source' | 'destination' | 'refund') => Promise<void>
  beforeStart?: (input: TStartTransaction, signal: AbortSignal) => Promise<void>
  observeSettlement?: (record: TTransactionRecord, signal: AbortSignal) => Promise<TSettlementEvidence>
  settlementIntervalMs?: number
  persistence?: TTransactionPersistence
  coordinate?: (id: string, observe: () => Promise<void>) => Promise<void>
  now?: () => number
  id?: () => string
  retryMs?: number
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Transaction operation unavailable'
const isRejected = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      (('code' in error && error.code === 4001) || ('cause' in error && isRejected(error.cause)))
  )

const isPreparationFailure = (error: unknown): boolean =>
  error instanceof VaultWidgetPreparationError ||
  Boolean(error && typeof error === 'object' && 'cause' in error && isPreparationFailure(error.cause))

/** Provider-owned runner and observer. UI subscriptions never start receipt polling. */
export function createTransactionLifecycle(options: TLifecycleOptions) {
  const state: {
    snapshot: TLifecycleSnapshot
    running: boolean
    generation: number
    unsubscribe?: () => void
  } = {
    snapshot: { records: [], flows: [], history: options.persistence ? 'loading' : 'ready' },
    running: false,
    generation: 0
  }
  const listeners = new Set<() => void>()
  const settlementWorker = { busy: false }
  const observers = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const refreshes = new Set<string>()
  const paused = new Set<string>()
  const continuations = new Map<string, () => void>()
  const runningFlows = new Set<string>()
  const effects = new Set<string>()
  const refreshCallbacks = new Map<string, () => Promise<void>>()
  const pendingWrites = new Map<string, Promise<void>>()
  const now = options.now ?? Date.now
  const id = options.id ?? (() => crypto.randomUUID())
  const retryMs = options.retryMs ?? 10_000
  const publish = (snapshot: TLifecycleSnapshot): void => {
    state.snapshot = snapshot
    listeners.forEach((listener) => {
      listener()
    })
  }
  const getRecord = (recordId: string) => state.snapshot.records.find((record) => record.id === recordId)
  const putRecord = (record: TTransactionRecord): void => {
    const exists = getRecord(record.id)
    publish({
      ...state.snapshot,
      records: exists
        ? state.snapshot.records.map((item) => (item.id === record.id ? record : item))
        : [...state.snapshot.records, record]
    })
  }
  const putFlow = (flow: TTransactionFlow): void => {
    publish({ ...state.snapshot, flows: [...state.snapshot.flows.filter((item) => item.id !== flow.id), flow] })
  }
  const boundedStorage = async <T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = 5_000): Promise<T> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error('Transaction history storage timed out')),
            { once: true }
          )
        )
      ])
    } finally {
      clearTimeout(timeout)
    }
  }
  const mergeSaved = (record: TTransactionRecord): void => {
    const local = getRecord(record.id)
    if (!local) {
      putRecord(record)
      return
    }
    if (
      local.owner !== record.owner ||
      transactionIdentity(local) !== transactionIdentity(record) ||
      JSON.stringify(local.settlement) !== JSON.stringify(record.settlement)
    )
      throw new Error('Hydrated transaction identity changed')
    // Provider errors can increase a local revision while another tab confirms. Merge evidence,
    // rather than letting a larger local counter hide a durable receipt.
    const withSafe = record.safe?.execution
      ? reduceTransaction(local, {
          kind: 'safe-execution',
          result: record.safe.execution,
          observedAt: record.safe.execution.observedAt
        })
      : local
    if (withSafe !== local) putRecord(withSafe)
    if (record.source) {
      const withSource = reduceTransaction(withSafe, {
        kind: 'receipt',
        result: record.source,
        observedAt: record.source.observedAt
      })
      const withDestination = record.destination
        ? reduceTransaction(withSource, { kind: 'settlement', evidence: record.destination })
        : withSource
      const withConflict = record.conflict
        ? reduceTransaction(withDestination, { kind: 'conflict', message: record.conflict })
        : withDestination
      const next =
        record.refresh === 'success' || withConflict.refresh === 'idle'
          ? reduceTransaction(withConflict, { kind: 'refresh', status: record.refresh, message: record.refreshError })
          : withConflict
      if (next !== local) putRecord(next)
    } else if (!local.source && record.revision > local.revision && !local.safe?.execution)
      putRecord({ ...record, conflict: local.conflict ?? record.conflict, storageError: local.storageError })
    if (record.settlementTracking)
      putRecord(
        reduceTransaction(getRecord(record.id)!, { kind: 'settlement-check', tracking: record.settlementTracking })
      )
    Object.entries(record.milestoneRefresh ?? {}).forEach(([milestone, value]) => {
      if (value)
        putRecord(
          reduceTransaction(getRecord(record.id)!, {
            kind: 'milestone-refresh',
            milestone: milestone as 'source' | 'refund',
            status: value.status,
            message: value.error
          })
        )
    })
    if (record.conflict)
      putRecord(reduceTransaction(getRecord(record.id)!, { kind: 'conflict', message: record.conflict }))
  }
  const persist = (record: TTransactionRecord, observation?: TTransactionObservation): Promise<void> => {
    if (!options.persistence) return Promise.resolve()
    const write = (pendingWrites.get(record.id) ?? Promise.resolve()).then(async () => {
      try {
        const saved = await boundedStorage((signal) => options.persistence!.apply(record, observation, signal))
        mergeSaved(saved)
        const latest = getRecord(record.id)
        if (latest?.storageError) putRecord({ ...latest, storageError: undefined })
      } catch (error) {
        const latest = getRecord(record.id)
        if (latest)
          putRecord({
            ...latest,
            storageError: 'History could not be saved. Keep this window open; reload recovery is limited.'
          })
        console.warn('[Transaction lifecycle] History storage unavailable', errorMessage(error))
        schedule(`save:${record.id}`, () => {
          const current = getRecord(record.id)
          if (current) void persist(current)
        })
      }
    })
    pendingWrites.set(record.id, write)
    void write.finally(() => {
      if (pendingWrites.get(record.id) === write) pendingWrites.delete(record.id)
    })
    return write
  }
  const observe = (recordId: string, observation: TTransactionObservation): Promise<void> => {
    const current = getRecord(recordId)
    if (!current) return Promise.resolve()
    const next = reduceTransaction(current, observation)
    if (next !== current) putRecord(next)
    return persist(next, observation)
  }
  function schedule(key: string, operation: () => void, delay = retryMs): void {
    if (!state.running || timers.has(key)) return
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        if (state.running) operation()
      }, delay)
    )
  }
  async function refresh(recordId: string): Promise<void> {
    const record = getRecord(recordId)
    if (
      !record ||
      selectTransaction(record).outcome !== 'success' ||
      refreshes.has(recordId) ||
      record.refresh === 'success' ||
      record.refresh === 'error'
    )
      return
    refreshes.add(recordId)
    void observe(recordId, { kind: 'refresh', status: 'pending' })
    try {
      await awaitTransactionRefresh(
        refreshCallbacks.get(recordId) ?? (() => options.refresh?.(record) ?? Promise.resolve())
      )
      void observe(recordId, { kind: 'refresh', status: 'success' })
    } catch (error) {
      void observe(recordId, {
        kind: 'refresh',
        status: 'error',
        message: `Your transaction was confirmed, but balances could not be refreshed. ${errorMessage(error)}`
      })
    } finally {
      refreshes.delete(recordId)
      if (getRecord(recordId)?.refresh === 'success') refreshCallbacks.delete(recordId)
    }
  }
  async function refreshMilestone(recordId: string, milestone: 'source' | 'refund'): Promise<void> {
    const record = getRecord(recordId)
    const key = `${recordId}:${milestone}`
    if (
      !record ||
      record.settlement === 'same-chain' ||
      !hasSuccessfulSourceReceipt(record) ||
      record.conflict ||
      (milestone === 'refund' && record.destination?.funds !== 'refunded') ||
      ['success', 'error'].includes(record.milestoneRefresh?.[milestone]?.status ?? '') ||
      refreshes.has(key)
    )
      return
    refreshes.add(key)
    void observe(recordId, { kind: 'milestone-refresh', milestone, status: 'pending' })
    try {
      await awaitTransactionRefresh(() => options.refresh?.(record, milestone) ?? Promise.resolve())
      void observe(recordId, { kind: 'milestone-refresh', milestone, status: 'success' })
    } catch (error) {
      void observe(recordId, { kind: 'milestone-refresh', milestone, status: 'error', message: errorMessage(error) })
    } finally {
      refreshes.delete(key)
    }
  }
  async function settleNext(): Promise<void> {
    if (!state.running || settlementWorker.busy) return
    settlementWorker.busy = true
    const generation = state.generation
    const interval = options.settlementIntervalMs ?? 10_000
    const task = async () => {
      if (options.coordinate && options.persistence) {
        await hydrate()
        if (state.snapshot.history !== 'ready') return
      }
      if (generation !== state.generation) return
      const candidate = state.snapshot.records
        .filter((record) => {
          if (
            record.settlement === 'same-chain' ||
            !hasSuccessfulSourceReceipt(record) ||
            record.conflict ||
            record.settlementTracking?.paused ||
            (record.settlementTracking?.nextCheckAt ?? 0) > now()
          )
            return false
          const outcome = settlementOutcome(record.settlement, record.destination)
          return (
            outcome !== 'delivered' &&
            (outcome !== 'failed' ||
              (record.destination?.funds !== 'refunded' &&
                (['refundable', 'refund-pending', 'recoverable'].includes(record.destination?.funds ?? '') ||
                  Boolean(record.destination?.recovery))))
          )
        })
        .toSorted(
          (a, b) =>
            (a.settlementTracking?.checkedAt ?? 0) - (b.settlementTracking?.checkedAt ?? 0) || a.id.localeCompare(b.id)
        )[0]
      if (!candidate) return
      const checkedAt = now()
      const attempt = (candidate.settlementTracking?.attempt ?? 0) + 1
      const expiresAt = candidate.settlementTracking?.expiresAt ?? checkedAt + 24 * 60 * 60 * 1000
      const tracking = { attempt, checkedAt, expiresAt }
      if (checkedAt >= expiresAt) {
        await observe(candidate.id, {
          kind: 'settlement-check',
          tracking: {
            ...tracking,
            paused: true,
            error: 'Automatic bridge tracking paused. Recheck the transaction or use its bridge tracker.'
          }
        })
        return
      }
      await observe(candidate.id, {
        kind: 'settlement-check',
        tracking: { ...tracking, nextCheckAt: checkedAt + interval }
      })
      try {
        if (!options.observeSettlement)
          throw new Error(
            'Automatic bridge tracking is unavailable for this host. Use the source transaction or bridge tracker.'
          )
        const evidence = await boundedStorage(
          (signal) => options.observeSettlement!(getRecord(candidate.id)!, signal),
          9_000
        )
        if (generation !== state.generation) return
        await observe(candidate.id, { kind: 'settlement', evidence })
        await observe(candidate.id, {
          kind: 'settlement-check',
          tracking: {
            ...tracking,
            nextCheckAt: Math.max(checkedAt + interval, evidence.nextCheckAt ?? 0)
          }
        })
        void refresh(candidate.id)
        void refreshMilestone(candidate.id, 'refund')
      } catch (error) {
        if (generation !== state.generation) return
        await observe(candidate.id, {
          kind: 'settlement-check',
          tracking: {
            ...tracking,
            nextCheckAt: Math.max(
              checkedAt + interval,
              error &&
                typeof error === 'object' &&
                'nextCheckAt' in error &&
                typeof error.nextCheckAt === 'number' &&
                Number.isFinite(error.nextCheckAt)
                ? error.nextCheckAt
                : 0
            ),
            error: errorMessage(error)
          }
        })
      }
    }
    try {
      if (options.coordinate) await options.coordinate('settlement', task)
      else await task()
    } catch (error) {
      console.warn('[Transaction lifecycle] Settlement coordination unavailable', errorMessage(error))
    } finally {
      settlementWorker.busy = false
      schedule('settlement', () => void settleNext(), interval)
    }
  }
  async function track(recordId: string): Promise<void> {
    const record = getRecord(recordId)
    if (
      !state.running ||
      !record ||
      record.source ||
      selectTransaction(record).outcome === 'error' ||
      observers.has(recordId)
    )
      return
    observers.add(recordId)
    const generation = state.generation
    try {
      const task = async (): Promise<void> => {
        if (options.coordinate && options.persistence) {
          // Re-read after acquiring host ownership: another tab may have settled while this worker waited.
          const saved = await boundedStorage(options.persistence.load).catch(() => [])
          const record = saved.find((item) => item.id === recordId)
          if (generation !== state.generation) return
          if (record) mergeSaved(record)
        }
        const latest = getRecord(recordId)
        if (
          !latest ||
          latest.source ||
          selectTransaction(latest).outcome === 'error' ||
          generation !== state.generation
        )
          return
        try {
          if (latest.safe && latest.safe.execution?.status !== 'success') {
            const observeSafe = options.execution().observeSafeExecution
            if (!observeSafe) throw new Error('Safe execution observation is unavailable')
            const result = await boundedStorage(() =>
              observeSafe({
                chainId: latest.original.canonicalChainId,
                executionChainId: latest.original.executionChainId,
                proposalId: latest.safe!.proposalId
              })
            )
            if (generation !== state.generation) return
            await observe(recordId, { kind: 'safe-execution', result, observedAt: now() })
            if (result.status !== 'success') return
          }
          const admitted = getRecord(recordId)!
          if (!admitted.effective.hash || admitted.conflict) return
          const result = await options.execution().waitForReceipt({
            chainId: latest.effective.canonicalChainId,
            hash: admitted.effective.hash,
            executionChainId: latest.effective.executionChainId,
            confirmations: latest.confirmations
          })
          if (generation !== state.generation) return
          const saved = observe(recordId, { kind: 'receipt', result, observedAt: now() })
          void refresh(recordId)
          void refreshMilestone(recordId, 'source')
          schedule('settlement', () => void settleNext(), 0)
          await saved
        } catch {
          if (generation === state.generation)
            await observe(recordId, {
              kind: 'tracking-error',
              message: 'Confirmation could not be verified. Tracking will retry; do not submit this transaction again.'
            })
        }
      }
      if (options.coordinate) await options.coordinate(recordId, task)
      else await task()
    } catch {
      if (generation === state.generation)
        await observe(recordId, {
          kind: 'tracking-error',
          message: 'Tracking is temporarily unavailable. Confirmation will be checked again.'
        })
    } finally {
      observers.delete(recordId)
      if (!getRecord(recordId)?.source && selectTransaction(getRecord(recordId)!).outcome !== 'error')
        schedule(`observe:${recordId}`, () => void track(recordId))
    }
  }
  async function hydrate(): Promise<void> {
    if (!options.persistence) return
    const generation = state.generation
    try {
      const records = await boundedStorage(options.persistence.load)
      if (generation !== state.generation) return
      records.forEach((record) => {
        mergeSaved(record)
        const previousFlow = state.snapshot.flows.find((flow) => flow.id === record.flowId)
        const previousRecord = previousFlow?.recordId ? getRecord(previousFlow.recordId) : undefined
        if (!previousFlow || (previousRecord && (record.sequence?.index ?? 0) > (previousRecord.sequence?.index ?? 0)))
          putFlow({
            id: record.flowId,
            intentKey: record.intentKey,
            owner: record.owner,
            recordId: record.id,
            phase: 'pending',
            stepId: record.stepId,
            stepIndex: record.sequence?.index ?? 0,
            stepCount: record.sequence?.count ?? 1,
            stepLabel: record.sequence?.label
          })
        void track(record.id)
        if (record.source && record.refresh !== 'success') void refresh(record.id)
        void refreshMilestone(record.id, 'source')
        void refreshMilestone(record.id, 'refund')
      })
      publish({ ...state.snapshot, history: 'ready' })
    } catch {
      if (generation !== state.generation) return
      publish({ ...state.snapshot, history: 'unavailable' })
      schedule('hydrate', () => void hydrate())
    }
  }
  const waitForHistory = (): Promise<void> =>
    new Promise((resolve) => {
      const check = (): void => {
        if (state.snapshot.history === 'ready') {
          listeners.delete(check)
          resolve()
        }
      }
      listeners.add(check)
      check()
    })
  const waitForRecord = (recordId: string): Promise<VaultWidgetTransactionReceiptResult> =>
    new Promise((resolve, reject) => {
      const check = (): void => {
        const record = getRecord(recordId)
        if (record?.safe && selectTransaction(record).outcome === 'error') {
          listeners.delete(check)
          reject(new Error(selectTransaction(record).label))
          return
        }
        if (record?.source && !record.conflict) {
          listeners.delete(check)
          resolve(record.source)
        }
      }
      listeners.add(check)
      check()
    })
  const findActiveFlow = (
    owner: Address,
    intentKey: string,
    previousIntentIds: readonly string[] = []
  ): TTransactionFlow | undefined =>
    state.snapshot.flows.find(
      (flow) =>
        flow.owner.toLowerCase() === owner.toLowerCase() &&
        [intentKey, ...previousIntentIds].includes(flow.intentKey) &&
        (runningFlows.has(flow.id) ||
          flow.phase === 'confirming' ||
          (flow.recordId
            ? ['pending', 'unknown'].includes(selectTransaction(getRecord(flow.recordId)!).outcome)
            : flow.phase === 'unknown'))
    )
  const start = (input: TStartTransaction): string => {
    const existing =
      state.snapshot.flows.find((flow) => flow.id === input.commandId) ??
      findActiveFlow(input.owner, input.plan.intent.id, input.previousIntentIds)
    if (existing) {
      // React StrictMode reattaches the same initial command before it can request the wallet.
      // Reopening a submitted sequence uses a new command and never resumes it implicitly.
      if (existing.id === input.commandId && existing.phase === 'confirming' && existing.stepIndex === 0)
        paused.delete(existing.id)
      return existing.id
    }
    const intentKeys = [...new Set([input.plan.intent.id, ...(input.previousIntentIds ?? [])])].sort()
    const frozenPlan = structuredClone(input.plan)
    const steps = frozenPlan.steps.filter((step) => step.kind !== 'refresh' && step.kind !== 'switch-chain')
    const call = steps[0]
    if (
      !call ||
      frozenPlan.steps.some(
        (step) =>
          !['execute', 'approve', 'reset-approval', 'safe-proposal', 'permit', 'prepare', 'refresh'].includes(step.kind)
      ) ||
      new Set(steps.map((step) => step.id)).size !== steps.length ||
      steps.some((step) => step.chainId !== call.chainId) ||
      (!input.settlement &&
        [input.display, ...Object.values(input.displayByStep ?? {})].some(
          (display) => display?.bridgeProtocol || (display?.toChainId && display.toChainId !== call.chainId)
        )) ||
      (input.settlement &&
        (!isSettlementRequirement(input.settlement) || input.settlement.destinationChainId === call.chainId))
    )
      throw new Error('This lifecycle accepts one reviewed source-chain sequence')
    const frozen = {
      plan: frozenPlan,
      display: structuredClone(input.display),
      displayByStep: structuredClone(input.displayByStep),
      settlement: structuredClone(input.settlement)
    }
    const flow: TTransactionFlow = {
      id: input.commandId,
      owner: input.owner,
      intentKey: input.plan.intent.id,
      phase: 'confirming',
      stepId: call.id,
      stepIndex: 0,
      stepCount: steps.length,
      stepLabel: call.label
    }
    putFlow(flow)
    const active = { recordId: id() }
    const executionChainId = options.executionChainId(call.chainId)
    const preparedSettlements = new Map<string, TSettlementRequirement>()
    const prepared = new Map<string, TPreparedStep>()
    if (!executionChainId) {
      putFlow({ ...flow, phase: 'blocked', error: 'Execution network unavailable' })
      return flow.id
    }
    const adapter = options.execution()
    const reviewedChainId = options.wallet().chainId
    const assertWallet = (expectedChainId = executionChainId, authorize = true): void => {
      if (paused.has(flow.id)) throw new Error('Transaction paused. Close and review before continuing.')
      if (authorize) input.authorize?.()
      const wallet = options.wallet()
      if (wallet.address?.toLowerCase() !== flow.owner.toLowerCase() || wallet.chainId !== expectedChainId)
        throw new Error('Wallet or network changed. Close and review the transaction again.')
    }
    const assertPriorReceipts = (): void => {
      if (
        state.snapshot.records.some(
          (record) => record.flowId === flow.id && selectTransaction(record).outcome !== 'success'
        )
      )
        throw new Error('An earlier transaction is unresolved. Check its confirmation before continuing.')
    }
    const adoptRecovered = (): boolean => {
      const recovered = state.snapshot.records.find(
        (record) =>
          record.owner.toLowerCase() === flow.owner.toLowerCase() &&
          intentKeys.includes(record.intentKey) &&
          ['pending', 'unknown'].includes(selectTransaction(record).outcome)
      )
      if (recovered) {
        putFlow({
          ...flow,
          phase: 'pending',
          recordId: recovered.id,
          stepId: recovered.stepId,
          stepIndex: recovered.sequence?.index ?? 0,
          stepCount: recovered.sequence?.count ?? 1,
          stepLabel: recovered.sequence?.label
        })
        return true
      }
      return false
    }
    // The existing sequential runner remains the only executor; receipt ownership is delegated to this service.
    runningFlows.add(flow.id)
    const run = async (): Promise<void> => {
      // Hydration may reveal the same unfinished intent after reload. Adopt it before any wallet request.
      await Promise.resolve()
      // A timed-out read is not empty history. Only a successful hydration opens this gate.
      await waitForHistory()
      // Re-read inside the flow lock: another tab may have submitted since initial hydration.
      if (options.coordinate && options.persistence) {
        await hydrate()
        await waitForHistory()
      }
      if (adoptRecovered()) return
      if (options.beforeStart)
        await boundedStorage((signal) => options.beforeStart!(input, signal)).catch((error) => {
          throw new VaultWidgetPreparationError(error)
        })
      // Request the initial source-network switch only after recovery/deduplication.
      // Subsequent account/network changes still require explicit review/Continue.
      try {
        assertWallet(reviewedChainId, false)
        if (reviewedChainId !== executionChainId) {
          await adapter.switchChain({ chainId: call.chainId })
          const deadline = Date.now() + 10_000
          const waitForWalletNetwork = async (): Promise<void> => {
            // React-backed hosts may publish the new chain after the switch promise resolves.
            const chainId = options.wallet().chainId
            assertWallet(chainId, false)
            if (chainId === executionChainId) return
            if (chainId !== reviewedChainId || Date.now() >= deadline)
              throw new Error('Wallet network switch did not complete. Close and review the transaction again.')
            await new Promise<void>((resolve) => setTimeout(resolve, 50))
            return waitForWalletNetwork()
          }
          await waitForWalletNetwork()
        }
        assertWallet(executionChainId, false)
      } catch (error) {
        throw new VaultWidgetPreparationError(error)
      }
      await executeTransactionPlan({
        account: flow.owner,
        plan: frozen.plan,
        prepareStep: input.prepareStep,
        afterStep: input.afterStep,
        beforeStep: async (step, outcome) => {
          if (step.kind === 'refresh') return
          if (step.kind === 'switch-chain') throw new Error('Unsupported transaction step')
          active.recordId = id()
          const stepIndex = steps.findIndex((item) => item.id === step.id)
          const progress = {
            ...flow,
            stepId: step.id,
            stepIndex,
            stepCount: steps.length,
            stepLabel: step.label,
            executionChainId
          }
          if (outcome.submissions.length > 0 || Object.keys(outcome.signatures ?? {}).length > 0) {
            // A closed view or changed wallet suspends the sequence, while existing records keep tracking.
            const wallet = options.wallet()
            if (
              paused.has(flow.id) ||
              wallet.address?.toLowerCase() !== flow.owner.toLowerCase() ||
              wallet.chainId !== executionChainId
            ) {
              paused.add(flow.id)
              await new Promise<void>((resolve) => {
                continuations.set(flow.id, resolve)
                putFlow({
                  ...progress,
                  phase: 'paused',
                  recordId: state.snapshot.flows.find((item) => item.id === flow.id)?.recordId,
                  error: 'Review the remaining step and continue when your wallet is ready.'
                })
              })
            }
          }
          putFlow({ ...progress, phase: 'confirming' })
        },
        adapter: {
          ...adapter,
          signPermit: async (parameters) => {
            assertWallet()
            assertPriorReceipts()
            if (!adapter.signPermit) throw new VaultWidgetPreparationError(new Error('Permit signing is unavailable'))
            return adapter.signPermit({ ...parameters, beforeSubmit: assertWallet })
          },
          proposeSafeBatch: async (parameters) => {
            assertWallet()
            assertPriorReceipts()
            await input.validate?.()
            assertWallet()
            if (!adapter.proposeSafeBatch)
              throw new VaultWidgetPreparationError(new Error('Safe proposals are unavailable'))
            return adapter.proposeSafeBatch({
              ...parameters,
              beforeSubmit: () => {
                assertWallet()
                assertPriorReceipts()
              }
            })
          },
          waitForSafeExecution: async () => (await waitForRecord(active.recordId)).receipt.transactionHash,
          execute: async (parameters) => {
            try {
              assertWallet()
              assertPriorReceipts()
              await input.validate?.()
              assertWallet()
            } catch (error) {
              putFlow({
                ...state.snapshot.flows.find((item) => item.id === flow.id)!,
                phase: 'blocked',
                error: errorMessage(error)
              })
              throw error
            }
            return adapter.execute({
              ...parameters,
              beforeSubmit: () => {
                try {
                  assertWallet()
                  assertPriorReceipts()
                } catch (error) {
                  putFlow({
                    ...state.snapshot.flows.find((item) => item.id === flow.id)!,
                    phase: 'blocked',
                    error: errorMessage(error)
                  })
                  throw error
                }
              }
            })
          },
          waitForReceipt: () => waitForRecord(active.recordId)
        },
        refresh: async () => undefined,
        onState: (progress) => {
          if (
            progress.status === 'confirming' &&
            ['execute', 'approve', 'reset-approval', 'safe-proposal', 'permit'].includes(progress.step.kind)
          ) {
            const step = progress.step as TPreparedStep
            const requests =
              step.kind === 'permit' ? [] : step.kind === 'safe-proposal' ? step.requests : [step.request]
            if (
              step.chainId !== call.chainId ||
              requests.some((request) => request.chainId !== call.chainId) ||
              (step.kind === 'safe-proposal' && (!step.requests.length || frozen.plan.walletType !== 'safe')) ||
              (step.kind !== 'safe-proposal' && frozen.plan.walletType === 'safe')
            )
              throw new VaultWidgetPreparationError(new Error('Prepared action changed the reviewed wallet or network'))
            if (frozen.settlement && step.id === steps.at(-1)?.id) {
              const requirement = input.describeSettlement?.(step.id) ?? frozen.settlement
              if (
                !isSettlementRequirement(requirement) ||
                requirement.destinationChainId !== frozen.settlement.destinationChainId
              )
                throw new VaultWidgetPreparationError(new Error('Reviewed destination changed'))
              preparedSettlements.set(step.id, structuredClone(requirement))
            }
            prepared.set(progress.step.id, structuredClone(progress.step as TPreparedStep))
            return
          }
          if (progress.status !== 'pending' && progress.status !== 'submitted') return
          const submission = progress.outcome.submissions.at(-1)
          if (!submission || getRecord(active.recordId)) return
          const step = prepared.get(progress.step.id)!
          if (step.kind === 'permit') return
          const recordId = active.recordId
          const stepIndex = steps.findIndex((item) => item.id === step.id)
          const requests = step.kind === 'safe-proposal' ? step.requests : [step.request]
          const request = requests[0]
          if (!request) throw new Error('Submitted action has no calls')
          const reference = {
            canonicalChainId: step.chainId,
            executionChainId,
            hash: submission.hash,
            ...(submission.proposalId ? { proposalId: submission.proposalId } : {})
          }
          const record: TTransactionRecord = {
            version: 1,
            id: recordId,
            flowId: flow.id,
            attemptId: id(),
            stepId: step.id,
            sequence: { index: stepIndex, count: steps.length, label: step.label },
            intentKey: flow.intentKey,
            owner: flow.owner,
            createdAt: now(),
            revision: 0,
            request: { ...request, value: (request.value ?? 0n).toString() },
            ...(submission.proposalId
              ? {
                  safe: {
                    proposalId: submission.proposalId,
                    requests: requests.map((request) => ({ ...request, value: (request.value ?? 0n).toString() }))
                  }
                }
              : {}),
            display: structuredClone(
              input.describeStep?.(step.id) ??
                frozen.displayByStep?.[step.id] ??
                (stepIndex === steps.length - 1 ? frozen.display : undefined)
            ),
            original: reference,
            effective: reference,
            settlement: preparedSettlements.get(step.id) ?? 'same-chain',
            confirmations: getTransactionConfirmations(step.chainId),
            refresh: 'idle'
          }
          putRecord(record)
          putFlow({
            ...flow,
            phase: 'pending',
            recordId,
            stepId: step.id,
            stepIndex,
            stepCount: steps.length,
            stepLabel: step.label
          })
          if (input.refresh && stepIndex === steps.length - 1 && record.settlement === 'same-chain')
            refreshCallbacks.set(recordId, input.refresh)
          void persist(record)
          void track(recordId)
        }
      })
      const latest = state.snapshot.flows.find((item) => item.id === flow.id)
      if (latest)
        putFlow({
          ...latest,
          phase:
            latest.recordId && selectTransaction(getRecord(latest.recordId)!).outcome !== 'success'
              ? 'pending'
              : 'success'
        })
    }
    const coordinatedRun = async (): Promise<void> => {
      if (!options.coordinate) return run()
      const claim = { acquired: false }
      // Claim every supported identity in a stable order, including IDs used by older tabs.
      const claimIdentity = async (index: number): Promise<void> => {
        const key = intentKeys[index]
        if (key === undefined) {
          claim.acquired = true
          return run()
        }
        await options.coordinate!(`flow:${flow.owner.toLowerCase()}:${key}`, () => claimIdentity(index + 1))
      }
      await claimIdentity(0)
      if (!claim.acquired) {
        // A different tab can own execution while this view adopts its saved submission.
        if (options.persistence) {
          await hydrate()
          await waitForHistory()
        }
        if (adoptRecovered()) return
        putFlow({
          ...flow,
          phase: 'blocked',
          error: 'This transaction flow is active in another window. Continue there or review again after it closes.'
        })
      }
    }
    void coordinatedRun()
      .catch((error: unknown) => {
        const latest = state.snapshot.flows.find((item) => item.id === flow.id)
        if (latest?.recordId || latest?.phase === 'blocked') return
        putFlow({
          ...(latest ?? flow),
          phase: isRejected(error) ? 'rejected' : isPreparationFailure(error) ? 'blocked' : 'unknown',
          error: errorMessage(error)
        })
      })
      .finally(() => runningFlows.delete(flow.id))
    return flow.id
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    supportsDestinationSettlement: Boolean(options.observeSettlement),
    getSnapshot: () => state.snapshot,
    findActiveFlow,
    start,
    continue: (flowId: string): void => {
      const resume = continuations.get(flowId)
      const flow = state.snapshot.flows.find((item) => item.id === flowId)
      if (!resume || !flow) return
      const wallet = options.wallet()
      const previous = flow.recordId ? getRecord(flow.recordId) : undefined
      if (
        wallet.address?.toLowerCase() !== flow.owner.toLowerCase() ||
        wallet.chainId !== (flow.executionChainId ?? previous?.original.executionChainId)
      ) {
        putFlow({ ...flow, error: 'Reconnect the reviewed wallet and network before continuing.' })
        return
      }
      continuations.delete(flowId)
      paused.delete(flowId)
      resume()
    },
    pause: (flowId: string) => {
      paused.add(flowId)
    },
    claimEffect: (flowId: string, effect: string): boolean => {
      const key = `${flowId}:${effect}`
      if (effects.has(key)) return false
      effects.add(key)
      return true
    },
    recheck: (recordId: string) => {
      const record = getRecord(recordId)
      if (record?.settlement !== 'same-chain' && record?.source) {
        void observe(recordId, {
          kind: 'settlement-check',
          tracking: {
            checkedAt: now(),
            nextCheckAt: record.settlementTracking?.nextCheckAt,
            expiresAt: now() + 24 * 60 * 60 * 1000
          }
        }).then(() => settleNext())
      } else void track(recordId)
    },
    recheckHistory: () => {
      if (state.running) void hydrate()
    },
    refresh: (recordId: string) => {
      const record = getRecord(recordId)
      ;(['source', 'refund'] as const).forEach((milestone) => {
        if (record?.milestoneRefresh?.[milestone]?.status === 'error') {
          void observe(recordId, { kind: 'milestone-refresh', milestone, status: 'idle' }).then(() =>
            refreshMilestone(recordId, milestone)
          )
        }
      })
      if (record?.refresh === 'error') {
        putRecord({ ...record, refresh: 'idle' })
        void refresh(recordId)
      }
    },
    connect: () => {
      state.running = true
      state.generation += 1
      if (options.persistence) publish({ ...state.snapshot, history: 'loading' })
      state.unsubscribe = options.persistence?.subscribe?.(() => void hydrate())
      void hydrate()
      state.snapshot.records.forEach((record) => void track(record.id))
      schedule('settlement', () => void settleNext(), 0)
      return () => {
        state.running = false
        runningFlows.forEach((flowId) => {
          if ((state.snapshot.flows.find((flow) => flow.id === flowId)?.stepCount ?? 1) > 1) paused.add(flowId)
        })
        state.generation += 1
        state.unsubscribe?.()
        timers.forEach(clearTimeout)
        timers.clear()
      }
    }
  }
}
export type TTransactionLifecycle = ReturnType<typeof createTransactionLifecycle>
