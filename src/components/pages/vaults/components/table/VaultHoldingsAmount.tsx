import { useWeb3 } from '@shared/contexts/useWeb3'
import { cl, formatTvlDisplay } from '@shared/utils'
import type { ReactElement } from 'react'

export function VaultHoldingsAmount({
  value,
  valueClassName
}: {
  value: number
  valueClassName?: string
}): ReactElement {
  const { address } = useWeb3()
  const isWalletActive = !!address
  const hasBalance = value > 0
  const isDusty = value < 0.01
  const shouldShowDash = isWalletActive && !hasBalance

  return (
    <div className={'flex flex-col items-end pt-0 text-right'}>
      <p
        className={cl(
          'yearn--table-data-section-item-value font-semibold',
          hasBalance ? 'text-text-primary' : 'text-text-tertiary',
          valueClassName
        )}
      >
        {shouldShowDash ? '-' : formatTvlDisplay(isDusty ? 0 : value)}
      </p>
    </div>
  )
}
