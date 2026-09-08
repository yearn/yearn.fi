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
    amount: record.display?.amount ?? '',
    fromAddress: record.display?.fromAddress,
    fromTokenName: record.display?.fromSymbol,
    toAddress: record.display?.toAddress,
    toTokenName: record.display?.toSymbol,
    toAmount: record.display?.toAmount,
    txHash: record.effective.hash,
    createdAt: record.createdAt / 1000,
    timeFinished:
      ['success', 'error'].includes(view.outcome) && record.source ? record.source.observedAt / 1000 : undefined,
    blockNumber: record.source?.receipt.blockNumber,
    status: view.outcome === 'unknown' ? 'submitted' : view.outcome
  }
}
