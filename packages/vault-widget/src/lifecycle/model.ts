import type { VaultWidgetTransactionReceiptResult, VaultWidgetTransactionRequest } from '@yearn/vault-widget/headless'
import type { VaultWidgetNotificationInput } from '@yearn/vault-widget/runtime'
import type { Address, Hash } from 'viem'

export type TTransactionReference = { canonicalChainId: number; executionChainId: number; hash: Hash }
export type TTransactionRecord = {
  version: 1
  id: string
  flowId: string
  attemptId: string
  stepId: string
  intentKey: string
  owner: Address
  createdAt: number // Unix milliseconds throughout the lifecycle API.
  revision: number
  request: Omit<VaultWidgetTransactionRequest, 'value'> & { value: string }
  display?: VaultWidgetNotificationInput
  original: TTransactionReference
  effective: TTransactionReference
  settlement: 'same-chain'
  confirmations: number
  source?: VaultWidgetTransactionReceiptResult & { observedAt: number }
  trackingError?: string
  conflict?: string
  storageError?: string
  refresh: 'idle' | 'pending' | 'success' | 'error'
  refreshError?: string
}
export type TTransactionObservation =
  | { kind: 'receipt'; result: VaultWidgetTransactionReceiptResult; observedAt: number }
  | { kind: 'conflict'; message: string }
  | { kind: 'tracking-error'; message: string }
  | { kind: 'refresh'; status: TTransactionRecord['refresh']; message?: string }

export type TTransactionPresentation = {
  outcome: 'pending' | 'unknown' | 'success' | 'error'
  label: string
  detail?: string
  reference: TTransactionReference
  canResubmit: false
}

export function selectTransaction(record: TTransactionRecord): TTransactionPresentation {
  const common = { reference: record.effective, canResubmit: false as const }
  if (record.conflict)
    return { ...common, outcome: 'unknown', label: 'Confirmation needs review', detail: record.conflict }
  if (record.source) {
    const reason = record.source.replacement?.reason
    if (reason === 'cancelled' || reason === 'replaced' || record.source.receipt.status !== 'success') {
      return {
        ...common,
        outcome: 'error',
        label:
          reason === 'cancelled'
            ? 'Transaction cancelled'
            : reason === 'replaced'
              ? 'Transaction replaced'
              : 'Transaction failed'
      }
    }
    return { ...common, outcome: 'success', label: 'Transaction confirmed', detail: record.refreshError }
  }
  if (record.trackingError)
    return { ...common, outcome: 'unknown', label: 'Checking confirmation', detail: record.trackingError }
  return { ...common, outcome: 'pending', label: 'Transaction pending' }
}

export function reduceTransaction(
  record: TTransactionRecord,
  observation: TTransactionObservation
): TTransactionRecord {
  if (observation.kind === 'conflict') {
    if (record.conflict) return record
    return { ...record, revision: record.revision + 1, conflict: observation.message }
  }
  if (observation.kind === 'tracking-error') {
    if (record.source || record.trackingError === observation.message) return record
    return { ...record, revision: record.revision + 1, trackingError: observation.message }
  }
  if (observation.kind === 'refresh') {
    if (!record.source || selectTransaction(record).outcome !== 'success') return record
    if (record.refresh === observation.status && record.refreshError === observation.message) return record
    // A stale worker must not undo a completed refresh from another worker.
    if (record.refresh === 'success' && observation.status !== 'success') return record
    return { ...record, revision: record.revision + 1, refresh: observation.status, refreshError: observation.message }
  }
  const { receipt, replacement } = observation.result
  if (record.source) {
    const previous = record.source.receipt
    if (previous.transactionHash !== receipt.transactionHash)
      throw new Error('Receipt does not match the confirmed transaction')
    if (
      previous.blockHash === receipt.blockHash &&
      previous.status === receipt.status &&
      record.source.replacement?.reason === replacement?.reason
    )
      return record
    return {
      ...record,
      revision: record.revision + 1,
      conflict: 'Conflicting receipt evidence. Check the transaction before continuing.'
    }
  }
  const sameHash = receipt.transactionHash?.toLowerCase() === record.effective.hash.toLowerCase()
  const validReplacement =
    replacement &&
    replacement.replacedHash.toLowerCase() === record.effective.hash.toLowerCase() &&
    !sameHash &&
    ['repriced', 'replaced', 'cancelled'].includes(replacement.reason)
  if ((!sameHash && !validReplacement) || (sameHash && replacement))
    throw new Error('Receipt does not match the submitted transaction')

  return {
    ...record,
    revision: record.revision + 1,
    effective: { ...record.effective, hash: receipt.transactionHash },
    source: { ...structuredClone(observation.result), observedAt: observation.observedAt },
    trackingError: undefined
  }
}

// A host must perform read/reduce/write atomically. No UI or legacy notification writer can patch these rows.
export type TTransactionPersistence = {
  load: (signal: AbortSignal) => Promise<readonly TTransactionRecord[]>
  apply: (
    record: TTransactionRecord,
    observation: TTransactionObservation | undefined,
    signal: AbortSignal
  ) => Promise<TTransactionRecord>
  subscribe?: (listener: () => void) => () => void
}
