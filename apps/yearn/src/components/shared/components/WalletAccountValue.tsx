import { useWalletVaultTotals } from '@shared/contexts/useWalletVaultTotals'

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

  const [whole, fraction] = totalValue
    .toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    .split('.')

  return (
    <p className="text-2xl font-bold text-text-primary">
      <span>${whole}</span>
      <span className="text-text-secondary">{totalValue > 0 ? `.${fraction}` : ''}</span>
    </p>
  )
}
