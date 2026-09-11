import { useWalletVaultTotals } from '@shared/contexts/useWalletVaultTotals'
import { formatUSD } from '@shared/utils'

export function WalletAccountValue() {
  const { totalValue, isLoading } = useWalletVaultTotals()

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading wallet value"
        className="mt-1 h-7 w-20 animate-pulse rounded bg-surface-tertiary"
      />
    )
  }

  return (
    <p className="text-2xl font-bold text-text-primary">
      <span>{formatUSD(Math.floor(totalValue), 0, 0)}</span>
      <span className="text-text-secondary">
        {totalValue > 0 ? `.${(totalValue % 1).toFixed(2).substring(2)}` : ''}
      </span>
    </p>
  )
}
