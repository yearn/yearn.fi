import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import type { TNotification } from '@shared/types/notifications'

export function getNotificationRefreshTargets(notification: TNotification): TUseBalancesTokens[] {
  const candidates = [
    notification.fromAddress ? { address: notification.fromAddress, chainID: notification.chainId } : undefined,
    notification.toAddress
      ? { address: notification.toAddress, chainID: notification.toChainId ?? notification.chainId }
      : undefined
  ].filter((candidate): candidate is TUseBalancesTokens => Boolean(candidate))

  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (other) =>
          other.chainID === candidate.chainID && other.address.toLowerCase() === candidate.address.toLowerCase()
      ) === index
  )
}

export function shouldInvalidateNotificationTokenQuery(
  queryKey: readonly unknown[],
  notification: TNotification
): boolean {
  if (queryKey[0] !== 'tokens' || typeof queryKey[1] !== 'string') return false
  const queryChainId = queryKey[2]
  const queryAccount = queryKey[4]
  if (typeof queryAccount !== 'string' || queryAccount.toLowerCase() !== notification.address.toLowerCase())
    return false

  return getNotificationRefreshTargets(notification).some(
    (target) =>
      queryChainId === target.chainID && (queryKey[1] as string).toLowerCase().includes(target.address.toLowerCase())
  )
}
