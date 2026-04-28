import type { SafeTransactionStatus } from '../shared/transactionOverlay.helpers'

export function resolveApprovalOverlayConnectedChainId(params: {
  accountChainId: number | undefined
  currentChainId: number
  targetChainId: number
  isWalletSafe: boolean
}): number {
  if (params.accountChainId) {
    return params.accountChainId
  }

  if (params.isWalletSafe) {
    return params.targetChainId
  }

  return params.currentChainId
}

export function resolveApprovalOverlayPendingSafeState(params: {
  txState: 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error'
  isWalletSafe: boolean
  hasExecutionReceipt: boolean
  safeTxStatus?: SafeTransactionStatus
  callsStatus?: 'pending' | 'success' | 'failure'
}): 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error' {
  const { txState, isWalletSafe, hasExecutionReceipt, safeTxStatus, callsStatus } = params

  if (txState !== 'pending' && txState !== 'submitted') return txState
  if (!isWalletSafe) return txState
  if (hasExecutionReceipt) return txState

  if (safeTxStatus === 'FAILED' || safeTxStatus === 'CANCELLED') return 'error'
  if (safeTxStatus === 'AWAITING_CONFIRMATIONS' || safeTxStatus === 'AWAITING_EXECUTION') return 'submitted'

  if (callsStatus === 'failure') return 'error'
  if (callsStatus === 'pending') return 'submitted'

  return txState
}
