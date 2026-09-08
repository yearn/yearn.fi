import {
  awaitTransactionRefresh,
  executeTransactionPlan,
  getTransactionConfirmations,
  type VaultWidgetExecutionAdapter,
  VaultWidgetPreparationError,
  type VaultWidgetTransactionPlan,
  type VaultWidgetTransactionReceiptResult
} from '@yearn/vault-widget/headless'
import {
  reduceTransaction,
  selectTransaction,
  type TTransactionObservation,
  type TTransactionPersistence,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle/model'
import type { VaultWidgetNotificationInput } from '@yearn/vault-widget/runtime'
import type { Address } from 'viem'

export type TTransactionFlow = {
  id: string
  owner: Address
  intentKey: string
  phase: 'confirming' | 'pending' | 'rejected' | 'blocked' | 'unknown'
  recordId?: string
  error?: string
}
export type TLifecycleSnapshot = { records: readonly TTransactionRecord[]; flows: readonly TTransactionFlow[] }
export type TStartTransaction = {
  commandId: string
  owner: Address
  plan: VaultWidgetTransactionPlan
  display?: VaultWidgetNotificationInput
  validate?: () => Promise<void>
  refresh?: () => Promise<void>
}
export type TLifecycleOptions = {
  execution: () => VaultWidgetExecutionAdapter
  executionChainId: (chainId: number) => number | undefined
  wallet: () => { address?: Address; chainId?: number }
  refresh?: (record: TTransactionRecord) => Promise<void>
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
    hydration?: Promise<void>
  } = {
    snapshot: { records: [], flows: [] },
    running: false,
    generation: 0
  }
  const listeners = new Set<() => void>()
  const observers = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const refreshes = new Set<string>()
  const paused = new Set<string>()
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
  const boundedStorage = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
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
    if (local.owner !== record.owner || local.original.hash !== record.original.hash)
      throw new Error('Hydrated transaction identity changed')
    // Provider errors can increase a local revision while another tab confirms. Merge evidence,
    // rather than letting a larger local counter hide a durable receipt.
    if (record.source) {
      const withSource = reduceTransaction(local, {
        kind: 'receipt',
        result: record.source,
        observedAt: record.source.observedAt
      })
      const next =
        record.refresh === 'success' || withSource.refresh === 'idle'
          ? reduceTransaction(withSource, { kind: 'refresh', status: record.refresh, message: record.refreshError })
          : withSource
      if (next !== local) putRecord(next)
    } else if (!local.source && record.revision > local.revision)
      putRecord({ ...record, storageError: local.storageError })
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
  function schedule(key: string, operation: () => void): void {
    if (!state.running || timers.has(key)) return
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        if (state.running) operation()
      }, retryMs)
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
  async function track(recordId: string): Promise<void> {
    const record = getRecord(recordId)
    if (!state.running || !record || record.source || observers.has(recordId)) return
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
        if (!latest || latest.source || generation !== state.generation) return
        try {
          const result = await options.execution().waitForReceipt({
            chainId: latest.effective.canonicalChainId,
            hash: latest.effective.hash,
            executionChainId: latest.effective.executionChainId,
            confirmations: latest.confirmations
          })
          if (generation !== state.generation) return
          const saved = observe(recordId, { kind: 'receipt', result, observedAt: now() })
          void refresh(recordId)
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
      if (!getRecord(recordId)?.source) schedule(`observe:${recordId}`, () => void track(recordId))
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
        if (!state.snapshot.flows.some((flow) => flow.id === record.flowId))
          putFlow({
            id: record.flowId,
            intentKey: record.intentKey,
            owner: record.owner,
            recordId: record.id,
            phase: 'pending'
          })
        void track(record.id)
        if (record.source && record.refresh !== 'success') void refresh(record.id)
      })
    } catch {
      schedule('hydrate', () => void hydrate())
    }
  }
  const waitForRecord = (recordId: string): Promise<VaultWidgetTransactionReceiptResult> =>
    new Promise((resolve) => {
      const check = (): void => {
        const record = getRecord(recordId)
        if (record?.source && !record.conflict) {
          listeners.delete(check)
          resolve(record.source)
        }
      }
      listeners.add(check)
      check()
    })
  const start = (input: TStartTransaction): string => {
    const existing = state.snapshot.flows.find(
      (flow) =>
        flow.id === input.commandId ||
        (flow.owner.toLowerCase() === input.owner.toLowerCase() &&
          flow.intentKey === input.plan.intent.id &&
          (flow.recordId
            ? ['pending', 'unknown'].includes(selectTransaction(getRecord(flow.recordId)!).outcome)
            : ['confirming', 'unknown'].includes(flow.phase)))
    )
    if (existing) {
      paused.delete(existing.id)
      return existing.id
    }
    const frozenPlan = structuredClone(input.plan)
    const call = frozenPlan.intent.calls[0]
    if (
      !call ||
      input.plan.walletType !== 'eoa' ||
      input.plan.intent.calls.length !== 1 ||
      input.plan.steps.some((step) => !['execute', 'refresh'].includes(step.kind)) ||
      input.display?.bridgeProtocol ||
      (input.display?.toChainId && input.display.toChainId !== call.request.chainId)
    )
      throw new Error('This lifecycle currently accepts one same-chain EOA action')
    const frozen = structuredClone({ ...input, validate: undefined, refresh: undefined })
    const flow: TTransactionFlow = {
      id: input.commandId,
      owner: input.owner,
      intentKey: input.plan.intent.id,
      phase: 'confirming'
    }
    putFlow(flow)
    const recordId = id()
    const executionChainId = options.executionChainId(call.request.chainId)
    if (!executionChainId) {
      putFlow({ ...flow, phase: 'blocked', error: 'Execution network unavailable' })
      return flow.id
    }
    const adapter = options.execution()
    const assertWallet = (): void => {
      if (paused.has(flow.id)) throw new Error('Transaction paused. Close and review before continuing.')
      const wallet = options.wallet()
      if (wallet.address?.toLowerCase() !== flow.owner.toLowerCase() || wallet.chainId !== executionChainId)
        throw new Error('Wallet or network changed. Close and review the transaction again.')
    }
    // The existing sequential runner remains the only executor; receipt ownership is delegated to this service.
    void (async () => {
      // Hydration may reveal the same unfinished intent after reload. Adopt it before any wallet request.
      await Promise.resolve()
      await state.hydration
      const recovered = state.snapshot.records.find(
        (record) =>
          record.owner.toLowerCase() === flow.owner.toLowerCase() &&
          record.intentKey === flow.intentKey &&
          ['pending', 'unknown'].includes(selectTransaction(record).outcome)
      )
      if (recovered) {
        putFlow({ ...flow, phase: 'pending', recordId: recovered.id })
        return
      }
      await executeTransactionPlan({
        account: flow.owner,
        plan: frozen.plan,
        adapter: {
          ...adapter,
          execute: async (parameters) => {
            try {
              assertWallet()
              await input.validate?.()
              assertWallet()
            } catch (error) {
              putFlow({ ...flow, phase: 'blocked', error: errorMessage(error) })
              throw error
            }
            return adapter.execute({
              ...parameters,
              beforeSubmit: () => {
                try {
                  assertWallet()
                } catch (error) {
                  putFlow({ ...flow, phase: 'blocked', error: errorMessage(error) })
                  throw error
                }
              }
            })
          },
          waitForReceipt: () => waitForRecord(recordId)
        },
        refresh: async () => undefined,
        onState: (progress) => {
          if (progress.status !== 'pending') return
          const hash = progress.outcome.submissions.at(-1)?.hash
          if (!hash) return
          const reference = { canonicalChainId: call.request.chainId, executionChainId, hash }
          const record: TTransactionRecord = {
            version: 1,
            id: recordId,
            flowId: flow.id,
            attemptId: id(),
            stepId: call.id,
            intentKey: flow.intentKey,
            owner: flow.owner,
            createdAt: now(),
            revision: 0,
            request: {
              ...frozen.plan.intent.calls[0].request,
              value: (frozen.plan.intent.calls[0].request.value ?? 0n).toString()
            },
            display: frozen.display,
            original: reference,
            effective: reference,
            settlement: 'same-chain',
            confirmations: getTransactionConfirmations(call.request.chainId),
            refresh: 'idle'
          }
          putRecord(record)
          putFlow({ ...flow, phase: 'pending', recordId })
          if (input.refresh) refreshCallbacks.set(recordId, input.refresh)
          void persist(record)
          void track(recordId)
        }
      })
    })().catch((error: unknown) => {
      const latest = state.snapshot.flows.find((item) => item.id === flow.id)
      if (latest?.recordId || latest?.phase === 'blocked') return
      putFlow({
        ...flow,
        phase: isRejected(error) ? 'rejected' : isPreparationFailure(error) ? 'blocked' : 'unknown',
        error: errorMessage(error)
      })
    })
    return flow.id
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state.snapshot,
    start,
    pause: (flowId: string) => {
      paused.add(flowId)
    },
    claimEffect: (flowId: string, effect: string): boolean => {
      const key = `${flowId}:${effect}`
      if (effects.has(key)) return false
      effects.add(key)
      return true
    },
    recheck: (recordId: string) => void track(recordId),
    refresh: (recordId: string) => {
      const record = getRecord(recordId)
      if (record?.refresh === 'error') {
        putRecord({ ...record, refresh: 'idle' })
        void refresh(recordId)
      }
    },
    connect: () => {
      state.running = true
      state.generation += 1
      state.unsubscribe = options.persistence?.subscribe?.(() => void hydrate())
      state.hydration = hydrate()
      state.snapshot.records.forEach((record) => void track(record.id))
      return () => {
        state.running = false
        state.generation += 1
        state.unsubscribe?.()
        timers.forEach(clearTimeout)
        timers.clear()
      }
    }
  }
}
export type TTransactionLifecycle = ReturnType<typeof createTransactionLifecycle>
