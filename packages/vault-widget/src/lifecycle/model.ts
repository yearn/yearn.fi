import type {
  TSafeExecution,
  VaultWidgetTransactionReceiptResult,
  VaultWidgetTransactionRequest
} from '@yearn/vault-widget/headless'
import {
  isCompleteReference,
  settlementOutcome,
  type TSettlementEvidence,
  type TSettlementRequirement,
  type TSettlementTracking
} from '@yearn/vault-widget/lifecycle/settlement'
import type { VaultWidgetNotificationInput } from '@yearn/vault-widget/runtime'
import { type Address, type Hash, type Hex, isHash } from 'viem'

export type TTransactionReference = {
  canonicalChainId: number
  executionChainId: number
  hash?: Hash
  proposalId?: Hex
}
export type TTransactionRecord = {
  version: 1
  id: string
  flowId: string
  attemptId: string
  stepId: string
  sequence?: { index: number; count: number; label: string }
  intentKey: string
  owner: Address
  createdAt: number // Unix milliseconds throughout the lifecycle API.
  revision: number
  request: Omit<VaultWidgetTransactionRequest, 'value'> & { value: string }
  display?: VaultWidgetNotificationInput
  original: TTransactionReference
  effective: TTransactionReference
  safe?: {
    proposalId: Hex
    requests: readonly (Omit<VaultWidgetTransactionRequest, 'value'> & { value: string })[]
    execution?: TSafeExecution & { observedAt: number }
  }
  settlement: 'same-chain' | TSettlementRequirement
  destination?: TSettlementEvidence
  settlementTracking?: TSettlementTracking
  milestoneRefresh?: Partial<Record<'source' | 'refund', { status: TTransactionRecord['refresh']; error?: string }>>
  confirmations: number
  source?: VaultWidgetTransactionReceiptResult & { observedAt: number }
  trackingError?: string
  conflict?: string
  storageError?: string
  refresh: 'idle' | 'pending' | 'success' | 'error'
  refreshError?: string
}
export type TTransactionObservation =
  | { kind: 'settlement'; evidence: TSettlementEvidence }
  | { kind: 'settlement-check'; tracking: TSettlementTracking }
  | {
      kind: 'milestone-refresh'
      milestone: 'source' | 'refund'
      status: TTransactionRecord['refresh']
      message?: string
    }
  | { kind: 'receipt'; result: VaultWidgetTransactionReceiptResult; observedAt: number }
  | { kind: 'safe-execution'; result: TSafeExecution; observedAt: number }
  | { kind: 'conflict'; message: string }
  | { kind: 'tracking-error'; message: string }
  | { kind: 'refresh'; status: TTransactionRecord['refresh']; message?: string }

export type TTransactionPresentation = {
  outcome: 'pending' | 'unknown' | 'success' | 'error'
  label: string
  detail?: string
  reference: TTransactionReference
  canResubmit: false
  recovery?: TSettlementEvidence['recovery']
  refund?: TTransactionReference
}

export function selectTransaction(record: TTransactionRecord): TTransactionPresentation {
  const common = { reference: record.effective, canResubmit: false as const }
  if (record.conflict)
    return { ...common, outcome: 'unknown', label: 'Confirmation needs review', detail: record.conflict }
  if (record.safe?.execution?.status === 'failed' || record.safe?.execution?.status === 'cancelled')
    return {
      ...common,
      outcome: 'error',
      label: record.safe.execution.status === 'cancelled' ? 'Safe transaction cancelled' : 'Safe execution failed'
    }
  if (record.safe && record.safe.execution?.status !== 'success')
    return {
      ...common,
      outcome: record.trackingError ? 'unknown' : 'pending',
      label: 'Awaiting Safe execution',
      detail: record.trackingError
    }
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
    if (record.settlement !== 'same-chain') {
      const evidence = record.destination
      const outcome = settlementOutcome(record.settlement, evidence)
      const references = {
        ...common,
        reference:
          outcome === 'delivered' && isCompleteReference(evidence?.destination)
            ? evidence.destination
            : common.reference,
        refund: isCompleteReference(evidence?.refund) ? evidence.refund : undefined,
        recovery: evidence?.recovery
      }
      if (outcome === 'delivered')
        return {
          ...references,
          outcome: 'success',
          label: 'Cross-chain transaction complete',
          detail: record.refreshError
        }
      if (outcome === 'failed')
        return {
          ...references,
          outcome: 'error',
          label:
            evidence?.funds === 'refunded' ? 'Cross-chain action failed; funds refunded' : 'Cross-chain action failed',
          detail: evidence?.detail
        }
      if (outcome === 'manual')
        return {
          ...references,
          outcome: 'unknown',
          label: 'Bridge action required',
          detail: evidence?.detail ?? 'The destination action needs manual completion.'
        }
      return {
        ...references,
        outcome:
          outcome === 'unknown' || record.settlementTracking?.error || record.settlementTracking?.paused
            ? 'unknown'
            : 'pending',
        label: 'Settling destination',
        detail:
          record.settlementTracking?.error ?? evidence?.detail ?? 'Source confirmed. Waiting for destination delivery.'
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
  if (observation.kind === 'settlement-check') {
    if (
      record.settlement === 'same-chain' ||
      JSON.stringify(record.settlementTracking) === JSON.stringify(observation.tracking) ||
      (record.settlementTracking?.checkedAt ?? 0) > (observation.tracking.checkedAt ?? 0)
    )
      return record
    return { ...record, revision: record.revision + 1, settlementTracking: { ...observation.tracking } }
  }
  if (observation.kind === 'milestone-refresh') {
    if (!record.source || (observation.milestone === 'refund' && record.destination?.funds !== 'refunded'))
      return record
    const previous = record.milestoneRefresh?.[observation.milestone]
    if (
      previous?.status === 'success' ||
      (previous?.status === observation.status && previous?.error === observation.message)
    )
      return record
    return {
      ...record,
      revision: record.revision + 1,
      milestoneRefresh: {
        ...record.milestoneRefresh,
        [observation.milestone]: { status: observation.status, error: observation.message }
      }
    }
  }
  if (observation.kind === 'settlement') {
    if (
      record.settlement === 'same-chain' ||
      !record.source ||
      record.source.receipt.status !== 'success' ||
      (record.source.replacement && record.source.replacement.reason !== 'repriced')
    )
      throw new Error('Destination evidence requires successful source confirmation')
    const next = observation.evidence
    const previous = record.destination
    if (
      next.destination &&
      (!isCompleteReference(next.destination) ||
        next.destination.canonicalChainId !== record.settlement.destinationChainId)
    )
      throw new Error('Destination reference does not match the reviewed network')
    if (next.refund && !isCompleteReference(next.refund)) throw new Error('Incomplete refund reference')
    const priorOutcome = settlementOutcome(record.settlement, previous)
    const nextOutcome = settlementOutcome(record.settlement, next)
    const terminal = ['delivered', 'failed'].includes(priorOutcome)
    if (terminal && ['delivered', 'failed'].includes(nextOutcome) && priorOutcome !== nextOutcome)
      return reduceTransaction(record, {
        kind: 'conflict',
        message: 'Conflicting destination evidence. Review the bridge transaction.'
      })
    if (next.outcome === 'delivered' && next.legs?.some((leg) => leg.outcome === 'failed' || leg.callback === 'failed'))
      return reduceTransaction(record, {
        kind: 'conflict',
        message: 'Delivery conflicts with incomplete or failed destination execution.'
      })
    if (previous && next.observedAt < previous.observedAt) return record
    if (
      next.legs?.some((leg) =>
        previous?.legs?.some(
          (old) =>
            old.id === leg.id &&
            ((old.outcome !== 'pending' && leg.outcome !== 'pending' && old.outcome !== leg.outcome) ||
              (old.callback &&
                old.callback !== 'pending' &&
                leg.callback &&
                leg.callback !== 'pending' &&
                old.callback !== leg.callback))
        )
      )
    )
      return reduceTransaction(record, { kind: 'conflict', message: 'Conflicting bridge leg or callback evidence.' })
    const legs = [...(previous?.legs ?? []), ...(next.legs ?? [])].reduce<NonNullable<TSettlementEvidence['legs']>>(
      (all, leg) => {
        const old = all.find((item) => item.id === leg.id)
        const retained = old && old.outcome !== 'pending' && leg.outcome === 'pending' ? old : leg
        return [
          ...all.filter((item) => item.id !== leg.id),
          {
            ...retained,
            callback:
              old?.callback && old.callback !== 'pending' && (!leg.callback || leg.callback === 'pending')
                ? old.callback
                : retained.callback
          }
        ]
      },
      []
    )
    const destination: TSettlementEvidence = {
      ...previous,
      ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)),
      ...(terminal && !['delivered', 'failed'].includes(nextOutcome)
        ? { outcome: previous!.outcome, authority: previous!.authority }
        : {}),
      ...(previous?.funds === 'refunded' ? { funds: 'refunded' as const } : {}),
      legs
    } as TSettlementEvidence
    if (JSON.stringify(destination) === JSON.stringify(previous)) return record
    return { ...record, revision: record.revision + 1, destination }
  }

  if (observation.kind === 'conflict') {
    if (record.conflict) return record
    return { ...record, revision: record.revision + 1, conflict: observation.message }
  }
  if (observation.kind === 'safe-execution') {
    if (!record.safe) throw new Error('Safe evidence does not match this transaction')
    const previous = record.safe.execution
    const next = observation.result
    if (previous && previous.status !== 'pending') {
      if (next.status === 'pending' || (previous.status === next.status && previous.hash === next.hash)) return record
      return reduceTransaction(record, {
        kind: 'conflict',
        message: 'Conflicting Safe execution evidence. Review the Safe queue.'
      })
    }
    if (
      !['pending', 'success', 'failed', 'cancelled'].includes(next.status) ||
      (next.status === 'success' && (!next.hash || !isHash(next.hash)))
    )
      throw new Error('Safe execution is missing its transaction hash')
    return {
      ...record,
      revision: record.revision + 1,
      safe: { ...record.safe, execution: { ...next, observedAt: observation.observedAt } },
      effective: next.hash ? { ...record.effective, hash: next.hash } : record.effective,
      trackingError: undefined
    }
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
  if (record.safe && (record.safe.execution?.status !== 'success' || replacement))
    throw new Error('Safe receipt lacks successful execution evidence')
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
  const sameHash = receipt.transactionHash?.toLowerCase() === record.effective.hash?.toLowerCase()
  const validReplacement =
    replacement &&
    replacement.replacedHash.toLowerCase() === record.effective.hash?.toLowerCase() &&
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

export const transactionIdentity = (record: TTransactionRecord): string =>
  `${record.original.executionChainId}:${record.safe ? `safe:${record.safe.proposalId}` : record.original.hash}`.toLowerCase()
