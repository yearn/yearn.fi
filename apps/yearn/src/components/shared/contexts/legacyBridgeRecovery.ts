import { decodeLegacyNotifications } from '@shared/contexts/legacyNotificationDecoder'
import type { TNotification } from '@shared/types/notifications'
import type { TStartTransaction } from '@yearn/vault-widget/lifecycle'

/** Until stage 5 decodes legacy records, never treat an unfinished legacy transfer as empty history. */
export function hasUnfinishedLegacyBridge(records: readonly TNotification[], owner: string): boolean {
  return records.some(
    (record) =>
      record.address?.toLowerCase() === owner.toLowerCase() &&
      (record.type?.includes('crosschain') || (record.toChainId && record.toChainId !== record.chainId)) &&
      record.bridgeStatus !== 'delivered' &&
      record.status !== 'error'
  )
}

export async function guardLegacyBridgeRecovery(input: TStartTransaction, signal: AbortSignal): Promise<void> {
  if (!input.settlement) return
  const records = await new Promise<TNotification[]>((resolve, reject) => {
    const request = indexedDB.open('yearn-notifications')
    const abort = () => reject(new Error('Legacy transaction history is unavailable. Retry after recovery.'))
    signal.addEventListener('abort', abort, { once: true })
    request.onupgradeneeded = () => {
      // A new wallet/browser has no legacy database; abort creation rather than installing a foreign schema.
      request.transaction?.abort()
      signal.removeEventListener('abort', abort)
      resolve([])
    }
    request.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(request.error)
    }
    request.onsuccess = () => {
      const db = request.result
      if (signal.aborted) {
        db.close()
        abort()
        return
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.close()
        signal.removeEventListener('abort', abort)
        reject(new Error('Legacy history schema is unavailable'))
        return
      }
      const transaction = db.transaction('notifications', 'readonly')
      const read = transaction.objectStore('notifications').getAll()
      transaction.oncomplete = () => {
        db.close()
        signal.removeEventListener('abort', abort)
        try {
          resolve(decodeLegacyNotifications(read.result))
        } catch (error) {
          reject(error)
        }
      }
      transaction.onerror = transaction.onabort = () => {
        db.close()
        signal.removeEventListener('abort', abort)
        reject(transaction.error)
      }
    }
  })
  if (hasUnfinishedLegacyBridge(records, input.owner))
    throw new Error(
      'An earlier cross-chain transaction is still unresolved in activity. Check that transfer before starting another cross-chain action.'
    )
}
