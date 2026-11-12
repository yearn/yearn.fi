import { isEnsoBridgeStatus } from '@shared/types/ensoBridge'
import { isBridgeProtocol, type TSettlementEvidence, type TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import { isHash } from 'viem'

const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
const chain = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const hash = (value: unknown) => (typeof value === 'string' && isHash(value) ? value : undefined)

/** Provider-specific evidence admission. No wallet calls or notification writes. */
export function normalizeEnsoSettlement(
  data: unknown,
  record: TTransactionRecord,
  observedAt: number
): TSettlementEvidence {
  const response = object(data)
  if (!response || !isEnsoBridgeStatus(response.status) || record.settlement === 'same-chain')
    throw new Error('Invalid bridge status response')
  const requirement = record.settlement
  if (
    (response.sourceChainId !== undefined && response.sourceChainId !== record.effective.canonicalChainId) ||
    (response.sourceTxHash !== undefined &&
      hash(response.sourceTxHash)?.toLowerCase() !== record.effective.hash?.toLowerCase()) ||
    (response.destinationChainId !== undefined && response.destinationChainId !== requirement.destinationChainId)
  )
    throw new Error('Bridge response does not match the submitted route')
  const destinationHash = hash(response.destinationTxHash)
  const refundHash = hash(response.refundTxHash)
  const requestId = hash(response.bridgeRequestId) ?? requirement.requestId
  const protocol = requirement.protocols[0]
  const recovery =
    protocol === 'relay' && requestId
      ? {
          kind: 'external' as const,
          url: `https://relay.link/transaction/${encodeURIComponent(requestId)}`,
          label: 'Open Relay tracker',
          chainId: requirement.destinationChainId
        }
      : protocol === 'stargate' && record.effective.hash
        ? {
            kind: 'external' as const,
            url: `https://layerzeroscan.com/tx/${record.effective.hash}`,
            label: 'Open bridge tracker',
            chainId: requirement.destinationChainId
          }
        : undefined
  const destinationEvent = object(response.ensoDestinationEvent)
  const callbackFailed = destinationEvent?.success === false || destinationEvent?.status === 'failed'
  const legs = Array.isArray(response.legs)
    ? response.legs.slice(0, 32).flatMap((value) => {
        const leg = object(value)
        if (
          !leg ||
          typeof leg.id !== 'string' ||
          !leg.id ||
          leg.id.length > 128 ||
          !['pending', 'delivered', 'failed'].includes(String(leg.status))
        )
          return []
        return [
          {
            id: leg.id,
            outcome: leg.status as 'pending' | 'delivered' | 'failed',
            callback: ['pending', 'success', 'failed'].includes(String(leg.callback))
              ? (leg.callback as 'pending' | 'success' | 'failed')
              : undefined
          }
        ]
      })
    : []
  const overall = requirement.protocols.length === 1 && (requirement.bridgeCount ?? 1) <= 1
  return {
    outcome:
      response.status === 'delivered'
        ? 'delivered'
        : response.status === 'failed'
          ? 'failed'
          : response.status === 'ready_for_manual_execution'
            ? 'manual'
            : response.status === 'unknown'
              ? 'unknown'
              : 'pending',
    authority: overall ? 'overall' : 'partial',
    observedAt:
      typeof response.observedAt === 'number' && Number.isFinite(response.observedAt)
        ? response.observedAt
        : observedAt,
    nextCheckAt:
      typeof response.nextCheckAt === 'number' && Number.isFinite(response.nextCheckAt)
        ? response.nextCheckAt
        : undefined,
    requestId,
    destination:
      destinationHash && chain(response.destinationChainId)
        ? {
            canonicalChainId: response.destinationChainId,
            executionChainId: response.destinationChainId,
            hash: destinationHash
          }
        : undefined,
    refund: refundHash
      ? {
          canonicalChainId: record.original.canonicalChainId,
          executionChainId: record.original.executionChainId,
          hash: refundHash
        }
      : undefined,
    funds: refundHash
      ? 'refunded'
      : response.status === 'delivered'
        ? 'delivered'
        : response.status === 'ready_for_manual_execution'
          ? 'recoverable'
          : response.status === 'failed'
            ? 'unknown'
            : 'in-transit',
    legs: callbackFailed ? [...legs, { id: 'enso:destination-callback', outcome: 'failed', callback: 'failed' }] : legs,
    recovery,
    detail:
      typeof response.error === 'string'
        ? response.error.slice(0, 1000)
        : !overall
          ? 'The available status covers only part of this route. Destination completion is unresolved.'
          : undefined
  }
}

export async function observeEnsoSettlement(
  record: TTransactionRecord,
  signal: AbortSignal
): Promise<TSettlementEvidence> {
  if (record.settlement === 'same-chain' || !record.effective.hash)
    throw new Error('Bridge tracking metadata is unavailable')
  const protocol =
    record.settlement.protocols[((record.settlementTracking?.attempt ?? 1) - 1) % record.settlement.protocols.length]
  if (!isBridgeProtocol(protocol))
    throw new Error('The route did not identify a trackable bridge. Check the source transaction for progress.')
  const params = new URLSearchParams({
    protocol,
    chainId: String(record.effective.canonicalChainId),
    txHash: record.effective.hash
  })
  const requestId = record.destination?.requestId ?? record.settlement.requestId
  if (requestId) params.set('requestId', requestId)
  const response = await fetch(`/api/enso/bridge-status?${params}`, { signal })
  const data = await response.json()
  if (!response.ok)
    throw Object.assign(
      new Error(typeof data?.error === 'string' ? data.error : 'Bridge tracking is temporarily unavailable'),
      { nextCheckAt: data?.nextCheckAt }
    )
  return normalizeEnsoSettlement(data, record, Date.now())
}
