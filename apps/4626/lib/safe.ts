import type { VaultWidgetSafeTransactionDetails, VaultWidgetSafeTransactionStatus } from '@yearn/vault-widget/runtime'
import type { Hash } from 'viem'

const statuses: Record<string, VaultWidgetSafeTransactionStatus> = {
  AWAITING_CONFIRMATIONS: 'awaiting-confirmations',
  AWAITING_EXECUTION: 'awaiting-execution',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  SUCCESS: 'success'
}
export async function getSafeTransactionDetails(
  safeTxHash: Hash
): Promise<VaultWidgetSafeTransactionDetails | undefined> {
  const { default: SafeAppsSDK } = await import('@safe-global/safe-apps-sdk')
  const transaction = await new SafeAppsSDK().txs.getBySafeTxHash(safeTxHash)
  const status = statuses[transaction.txStatus]
  return status
    ? { safeTxHash, status, executionTxHash: transaction.txHash ? (transaction.txHash as Hash) : undefined }
    : undefined
}
