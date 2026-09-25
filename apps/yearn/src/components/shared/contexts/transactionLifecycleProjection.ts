import type { TNotification } from '@shared/types/notifications'
import { selectTransaction, type TTransactionRecord } from '@yearn/vault-widget/lifecycle'

/** Read-only compatibility view. These records never enter the legacy notification database or pollers. */
export function projectLifecycleNotification(record: TTransactionRecord): TNotification {
  const view = selectTransaction(record)
  return {
    lifecycleRecord: record,
    type: (record.display?.type ?? 'deposit') as TNotification['type'],
    address: record.owner,
    chainId: record.effective.canonicalChainId,
    executionChainId: record.effective.executionChainId,
    toChainId: record.settlement !== 'same-chain' ? record.settlement.destinationChainId : record.display?.toChainId,
    destinationTxHash: record.destination?.destination?.hash,
    sourceConfirmedAt: record.source ? record.source.observedAt / 1000 : undefined,
    bridgeProtocol: record.settlement !== 'same-chain' ? record.settlement.protocols[0] : undefined,
    amount: record.display?.amount ?? '',
    fromAddress: record.display?.fromAddress,
    fromTokenName: record.display?.fromSymbol,
    toAddress: record.display?.toAddress,
    toTokenName: record.display?.toSymbol,
    toAmount: record.display?.toAmount,
    txHash: record.effective.hash,
    awaitingExecution: Boolean(record.safe && !record.safe.execution),
    createdAt: record.createdAt / 1000,
    timeFinished: ['success', 'error'].includes(view.outcome)
      ? (record.destination?.observedAt ??
          record.source?.observedAt ??
          record.safe?.execution?.observedAt ??
          record.createdAt) / 1000
      : undefined,
    blockNumber: record.source?.receipt.blockNumber,
    status: view.outcome === 'unknown' ? 'submitted' : view.outcome
  }
}
