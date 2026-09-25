import {
  isSettlementRequirement,
  reduceTransaction,
  type TTransactionPersistence,
  type TTransactionRecord,
  transactionIdentity
} from '@yearn/vault-widget/lifecycle'

const DATABASE = 'yearn-transaction-lifecycle'
const STORE = 'records'

function openDatabase(signal: AbortSignal): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('History request aborted'))
      return
    }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    const abort = () => reject(new Error('History request aborted'))
    request.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(request.error)
    }
    request.onsuccess = () => {
      signal.removeEventListener('abort', abort)
      if (signal.aborted) {
        request.result.close()
        reject(new Error('History request aborted'))
        return
      }
      resolve(request.result)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

function compatibleRecord(value: unknown): value is TTransactionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<TTransactionRecord>
  return (
    record.version === 1 &&
    typeof record.id === 'string' &&
    typeof record.owner === 'string' &&
    typeof record.flowId === 'string' &&
    typeof record.intentKey === 'string' &&
    Number.isSafeInteger(record.confirmations) &&
    record.confirmations! > 0 &&
    typeof record.request?.value === 'string' &&
    /^\d+$/.test(record.request.value) &&
    Number.isSafeInteger(record.original?.executionChainId) &&
    Number.isSafeInteger(record.effective?.executionChainId) &&
    (record.settlement === 'same-chain' || isSettlementRequirement(record.settlement)) &&
    Boolean((record.original?.hash || record.safe?.proposalId) && record.request)
  )
}

export function createTransactionLifecycleStorage(): TTransactionPersistence {
  const listeners = new Set<() => void>()
  const state: { channel?: BroadcastChannel } = {}
  const signalChange = (): void => state.channel?.postMessage('changed')
  return {
    async load(signal) {
      const db = await openDatabase(signal)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readonly')
        const request = transaction.objectStore(STORE).getAll()
        const abort = () => transaction.abort()
        signal.addEventListener('abort', abort, { once: true })
        transaction.oncomplete = () => {
          signal.removeEventListener('abort', abort)
          db.close()
          if (request.result.some((record: unknown) => !compatibleRecord(record))) {
            reject(new Error('Transaction history contains unsupported records'))
            return
          }
          resolve(request.result)
        }
        transaction.onabort = transaction.onerror = () => {
          signal.removeEventListener('abort', abort)
          db.close()
          reject(transaction.error ?? new Error('History read aborted'))
        }
      })
    },
    async apply(seed, observation, signal) {
      const db = await openDatabase(signal)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite')
        const store = transaction.objectStore(STORE)
        const request = store.get(seed.id)
        const result: { record?: TTransactionRecord } = {}
        const abort = () => transaction.abort()
        signal.addEventListener('abort', abort, { once: true })
        request.onsuccess = () => {
          try {
            const previous = request.result as TTransactionRecord | undefined
            if (
              previous &&
              (!compatibleRecord(previous) ||
                previous.owner !== seed.owner ||
                transactionIdentity(previous) !== transactionIdentity(seed) ||
                JSON.stringify(previous.settlement) !== JSON.stringify(seed.settlement))
            )
              throw new Error('Stored transaction identity does not match')
            const stored = previous ?? seed
            const base = seed.safe?.execution
              ? reduceTransaction(stored, {
                  kind: 'safe-execution',
                  result: seed.safe.execution,
                  observedAt: seed.safe.execution.observedAt
                })
              : stored
            // Failed writes are retried using the same record ID; merge its retained evidence atomically.
            const withSource =
              seed.source && !base.source
                ? reduceTransaction(base, { kind: 'receipt', result: seed.source, observedAt: seed.source.observedAt })
                : base
            const withDestination = seed.destination
              ? reduceTransaction(withSource, { kind: 'settlement', evidence: seed.destination })
              : withSource
            const withConflict = seed.conflict
              ? reduceTransaction(withDestination, { kind: 'conflict', message: seed.conflict })
              : withDestination
            const withTracking = seed.settlementTracking
              ? reduceTransaction(withConflict, { kind: 'settlement-check', tracking: seed.settlementTracking })
              : withConflict
            const withMilestones = Object.entries(seed.milestoneRefresh ?? {}).reduce(
              (record, [milestone, value]) =>
                value
                  ? reduceTransaction(record, {
                      kind: 'milestone-refresh',
                      milestone: milestone as 'source' | 'refund',
                      status: value.status,
                      message: value.error
                    })
                  : record,
              withTracking
            )
            const recovered =
              seed.refresh !== 'idle'
                ? reduceTransaction(withMilestones, {
                    kind: 'refresh',
                    status: seed.refresh,
                    message: seed.refreshError
                  })
                : withMilestones
            const next = observation ? reduceTransaction(recovered, observation) : recovered
            result.record = { ...next, storageError: undefined }
            store.put(result.record)
          } catch (error) {
            reject(error)
            transaction.abort()
          }
        }
        transaction.oncomplete = () => {
          signal.removeEventListener('abort', abort)
          db.close()
          signalChange()
          resolve(result.record!)
        }
        transaction.onabort = transaction.onerror = () => {
          signal.removeEventListener('abort', abort)
          db.close()
          reject(transaction.error ?? new Error('History write aborted'))
        }
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      if (!state.channel && typeof BroadcastChannel !== 'undefined') {
        state.channel = new BroadcastChannel(DATABASE)
        state.channel.onmessage = () =>
          listeners.forEach((notify) => {
            notify()
          })
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          state.channel?.close()
          state.channel = undefined
        }
      }
    }
  }
}

// Web Locks remain private to the host. Flow keys guard a reviewed sequence; record keys guard observation
// through the bounded atomic evidence write. A busy key returns without starting another worker.
export async function coordinateTransactionObservation(id: string, observe: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return observe()
  await navigator.locks.request(`yearn-transaction:${id}`, { ifAvailable: true }, async (lock) => {
    if (lock) await observe()
  })
}
