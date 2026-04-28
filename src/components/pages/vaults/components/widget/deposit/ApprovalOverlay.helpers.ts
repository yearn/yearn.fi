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
  hasReceiptTransactionHash: boolean
  callsStatus?: 'pending' | 'success' | 'failure'
}): 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error' {
  const { txState, isWalletSafe, hasReceiptTransactionHash, callsStatus } = params

  if (txState !== 'pending' && txState !== 'submitted') return txState
  if (!isWalletSafe) return txState
  if (hasReceiptTransactionHash) return txState
  if (callsStatus === 'failure') return 'error'
  if (callsStatus === 'pending') return 'submitted'

  return txState
}
