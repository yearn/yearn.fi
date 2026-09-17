import { useReadContract } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import type { VaultUserData, WidgetAddress } from '@yearn/vault-widget/types'
import { erc4626Abi } from 'viem'

export type TErc4626WithdrawQuote = { shares: bigint; assets: bigint; redeem: boolean }

/** Keep MAX tied to contract limits; never infer an exit from a PPS approximation. */
export function useErc4626WithdrawQuote({
  address,
  chainId,
  amount,
  limits,
  enabled
}: {
  address: WidgetAddress
  chainId: number
  amount: bigint
  limits?: VaultUserData['erc4626']
  enabled: boolean
}) {
  const redeem =
    !!limits &&
    amount > 0n &&
    amount === limits.maxWithdraw &&
    limits.maxRedeem > 0n &&
    limits.redeemableAssets === limits.maxWithdraw
  const shouldRead = enabled && !!limits && amount > 0n && amount <= limits.maxWithdraw
  const preview = useReadContract({
    address,
    abi: erc4626Abi,
    functionName: redeem ? 'previewRedeem' : 'previewWithdraw',
    args: [redeem ? (limits?.maxRedeem ?? 0n) : amount],
    chainId,
    query: { enabled: shouldRead, refetchInterval: 15_000, staleTime: 0 }
  })
  const quote: TErc4626WithdrawQuote | undefined =
    shouldRead && preview.data !== undefined && !preview.isError
      ? { shares: redeem ? limits!.maxRedeem : preview.data, assets: redeem ? preview.data : amount, redeem }
      : undefined
  return {
    quote,
    isLoading: shouldRead && (preview.isPending || preview.isFetching),
    error: shouldRead && preview.isError ? 'Unable to preview withdrawal. Please retry.' : undefined,
    refetch: preview.refetch
  }
}
