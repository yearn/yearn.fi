import type {
  TCreateNotificationParams,
  TCreateSubmittedNotificationParams,
  TNotification,
  TNotificationType,
  TUpdateNotificationParams
} from '@shared/types/notifications'
import { toAddress } from '@shared/utils'

export function isCrossChainNotificationType(type: TNotificationType): boolean {
  return type === 'crosschain zap' || type === 'crosschain withdraw zap'
}

export function buildNotificationEntry(
  params: TCreateNotificationParams | TCreateSubmittedNotificationParams,
  walletAddress: string | undefined,
  createdAt: number
): TNotification {
  const isCrossChain = isCrossChainNotificationType(params.type)
  const isSubmitted = 'txHash' in params

  return {
    address: toAddress(isSubmitted ? params.ownerAddress : walletAddress),
    type: params.type,
    amount: params.amount,
    fromAddress: toAddress(params.fromAddress),
    fromTokenName: params.fromSymbol,
    chainId: params.fromChainId,
    executionChainId: params.executionChainId ?? params.fromChainId,
    toAddress: params.toAddress ? toAddress(params.toAddress) : undefined,
    toTokenName: params.toSymbol,
    toAmount: params.toAmount,
    toChainId: params.toChainId !== params.fromChainId ? params.toChainId : undefined,
    spenderAddress: params.type === 'approve' ? toAddress(params.toAddress) : undefined,
    spenderName: params.type === 'approve' ? params.toSymbol : undefined,
    status: isSubmitted ? params.status : 'pending',
    txHash: isSubmitted ? params.txHash : undefined,
    createdAt,
    timeFinished: undefined,
    blockNumber: undefined,
    awaitingExecution: isSubmitted ? (params.awaitingExecution ?? false) : false,
    bridgeProtocol: params.bridgeProtocol,
    bridgeTrackingState: isCrossChain ? (params.bridgeProtocol ? 'active' : 'unavailable') : undefined,
    bridgeError:
      isCrossChain && !params.bridgeProtocol
        ? 'Automatic bridge tracking is unavailable for this route. Check the source transaction for progress.'
        : undefined
  }
}

export function shouldSetNotificationFinishedAt(params: TUpdateNotificationParams): boolean {
  const isBridgeInProgress = params.status === 'submitted' && Boolean(params.bridgeStatus)
  if (isBridgeInProgress) return false
  return Boolean(
    params.receipt ||
      params.status === 'success' ||
      params.status === 'error' ||
      (params.status === 'submitted' && !params.awaitingExecution)
  )
}

export function buildNotificationUpdate(params: TUpdateNotificationParams, nowSeconds: number): Partial<TNotification> {
  const txHash = params.txHash ?? params.receipt?.transactionHash
  const shouldSetTimeFinished = shouldSetNotificationFinishedAt(params)

  return {
    ...(txHash ? { txHash } : {}),
    ...(shouldSetTimeFinished ? { timeFinished: nowSeconds } : {}),
    ...(params.receipt ? { blockNumber: params.receipt.blockNumber } : {}),
    ...(params.receipt && params.bridgeStatus === 'pending' ? { sourceConfirmedAt: nowSeconds } : {}),
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.receipt || params.status === 'success' || params.status === 'error'
      ? { awaitingExecution: false }
      : params.awaitingExecution !== undefined
        ? { awaitingExecution: params.awaitingExecution }
        : {}),
    ...(params.bridgeStatus !== undefined ? { bridgeStatus: params.bridgeStatus } : {})
  }
}
