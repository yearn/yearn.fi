import type { TTransactionReference } from '@yearn/vault-widget/lifecycle/model'

export type TSettlementRequirement = {
  provider: 'enso'
  destinationChainId: number
  protocols: readonly string[]
  /** Route-time coverage. Missing or ambiguous leg IDs never imply complete coverage. */
  coverage: 'complete' | 'incomplete'
  legs: readonly { id: string; protocol: string; sourceChainId?: number; destinationChainId?: number }[]
  bridgeCount?: number
  requestId?: string
  estimatedSeconds?: number
}
export type TSettlementEvidence = {
  outcome: 'pending' | 'manual' | 'delivered' | 'failed' | 'unknown'
  authority: 'overall' | 'partial'
  observedAt: number
  nextCheckAt?: number
  destination?: TTransactionReference
  refund?: TTransactionReference
  requestId?: string
  legs?: readonly {
    id: string
    outcome: 'pending' | 'delivered' | 'failed'
    callback?: 'pending' | 'success' | 'failed'
  }[]
  funds?: 'unknown' | 'in-transit' | 'delivered' | 'refundable' | 'refund-pending' | 'refunded' | 'recoverable'
  recovery?: { kind: 'external'; url: string; label: string; chainId: number }
  detail?: string
}
export type TSettlementTracking = {
  attempt?: number
  checkedAt?: number
  nextCheckAt?: number
  error?: string
  paused?: boolean
  expiresAt?: number
}
export const isBridgeProtocol = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value)

export function settlementOutcome(requirement: TSettlementRequirement, evidence?: TSettlementEvidence) {
  if (!evidence) return 'pending'
  const failedLeg = evidence.legs?.some((leg) => leg.outcome === 'failed' || leg.callback === 'failed')
  if (evidence.outcome === 'delivered' && failedLeg) return 'unknown'
  if (evidence.authority === 'overall') return evidence.outcome
  if (failedLeg) return 'failed'
  const complete =
    requirement.coverage === 'complete' &&
    requirement.legs.length > 0 &&
    requirement.legs.every((required) =>
      evidence.legs?.some((leg) => leg.id === required.id && leg.outcome === 'delivered' && leg.callback === 'success')
    )
  return complete ? 'delivered' : evidence.outcome === 'manual' ? 'manual' : 'unknown'
}

/** Only complete references travel into selectors; never combine a new hash with an old network. */
export const isCompleteReference = (reference?: TTransactionReference): reference is TTransactionReference =>
  Boolean(
    reference?.hash &&
      /^0x[\da-f]{64}$/i.test(reference.hash) &&
      Number.isSafeInteger(reference.canonicalChainId) &&
      reference.canonicalChainId > 0 &&
      Number.isSafeInteger(reference.executionChainId) &&
      reference.executionChainId > 0
  )

export function isSettlementRequirement(value: unknown): value is TSettlementRequirement {
  if (!value || typeof value !== 'object') return false
  const requirement = value as TSettlementRequirement
  return (
    requirement.provider === 'enso' &&
    Number.isSafeInteger(requirement.destinationChainId) &&
    requirement.destinationChainId > 0 &&
    ['complete', 'incomplete'].includes(requirement.coverage) &&
    Array.isArray(requirement.protocols) &&
    requirement.protocols.length <= 16 &&
    requirement.protocols.every(isBridgeProtocol) &&
    Array.isArray(requirement.legs) &&
    requirement.legs.length <= 32 &&
    requirement.legs.every(
      (leg) =>
        leg && typeof leg.id === 'string' && leg.id.length > 0 && leg.id.length <= 128 && isBridgeProtocol(leg.protocol)
    ) &&
    new Set(requirement.legs.map((leg) => leg.id)).size === requirement.legs.length
  )
}
