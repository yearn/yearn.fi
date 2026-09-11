interface ResolveEnsoWithdrawInputAmountParams {
  requiredVaultShares: bigint
  isStakingWithdrawal: boolean
  isMaxWithdraw: boolean
  stakingRedeemableShares: bigint
  previewWithdrawShares?: bigint
  previewFailed: boolean
  allowOneToOneFallback: boolean
}

export function resolveEnsoWithdrawInputAmount({
  requiredVaultShares,
  isStakingWithdrawal,
  isMaxWithdraw,
  stakingRedeemableShares,
  previewWithdrawShares,
  previewFailed,
  allowOneToOneFallback
}: ResolveEnsoWithdrawInputAmountParams): bigint {
  if (!isStakingWithdrawal) return requiredVaultShares
  if (isMaxWithdraw) return stakingRedeemableShares
  if (previewWithdrawShares !== undefined) return previewWithdrawShares
  if (previewFailed && allowOneToOneFallback) return requiredVaultShares
  return 0n
}
