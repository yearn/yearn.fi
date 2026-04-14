export function resolveApprovalOverlayConnectedChainId(params: {
  accountChainId: number | undefined
  currentChainId: number
}): number {
  return params.accountChainId ?? params.currentChainId
}

export function resolveApprovalOverlayPendingSafeState(params: {
  txState: 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error'
  isWalletSafe: boolean
  hasReceiptTransactionHash: boolean
  callsStatus?: 'pending' | 'success' | 'failure'
}): 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error' {
  const { txState, isWalletSafe, hasReceiptTransactionHash, callsStatus } = params

  if (txState !== 'pending') return txState
  if (!isWalletSafe) return txState
  if (hasReceiptTransactionHash) return txState
  if (callsStatus === 'pending') return 'submitted'

  return txState
}
