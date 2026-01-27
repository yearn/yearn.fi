import { formatPercent } from '@shared/utils'
import type { FC } from 'react'
import { InfoOverlay } from '../shared/InfoOverlay'

interface AnnualReturnOverlayProps {
  isOpen: boolean
  onClose: () => void
  depositAmount: string
  tokenSymbol?: string
  estimatedReturn: string
  currentAPR: number
}

export const AnnualReturnOverlay: FC<AnnualReturnOverlayProps> = ({
  isOpen,
  onClose,
  depositAmount,
  tokenSymbol,
  estimatedReturn,
  currentAPR
}) => {
  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title="Estimated Annual Return">
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          The estimated annual return is calculated based on the vault's historical performance and current market
          conditions.
        </p>
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">Calculation factors:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary ml-2">
            <li>Current APR: {formatPercent(currentAPR * 100, 2, 2, 500)}</li>
            <li>
              Your deposit: {depositAmount} {tokenSymbol}
            </li>
            <li>
              Expected annual yield: ~{estimatedReturn} {tokenSymbol}
            </li>
          </ul>
        </div>
        <p className="text-xxs text-text-secondary mt-4">
          Please note that past performance does not guarantee future results. Actual returns may vary based on market
          volatility and vault strategy adjustments.
        </p>
      </div>
    </InfoOverlay>
  )
}
