export function resolveApprovalOverlayConnectedChainId(params: {
  accountChainId: number | undefined
  currentChainId: number
}): number {
  return params.accountChainId ?? params.currentChainId
}
