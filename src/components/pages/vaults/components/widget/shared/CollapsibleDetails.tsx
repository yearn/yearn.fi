import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatTAmount, formatUSD } from '@shared/utils'
import { type FC, type ReactNode, useState } from 'react'
import { formatUnits } from 'viem'

interface CollapsibleDetailsProps {
  pricePerShare: bigint
  vaultDecimals: number
  assetTokenSymbol?: string
  assetUsdPrice: number
  variant: 'deposit' | 'withdraw'
  onSummaryClick?: () => void
  children: ReactNode
}

function formatExchangeRate(
  variant: 'deposit' | 'withdraw',
  pricePerShare: bigint,
  vaultDecimals: number,
  tokenLabel: string,
  assetUsdPrice: number
): string {
  const formatOpts = { maximumFractionDigits: 4 }

  if (variant === 'deposit') {
    const sharesPerToken =
      pricePerShare > 0n
        ? formatTAmount({
            value: 10n ** BigInt(vaultDecimals * 2) / pricePerShare,
            decimals: vaultDecimals,
            options: formatOpts
          })
        : '0'
    return `1 ${tokenLabel} = ${sharesPerToken} vault shares (${formatUSD(assetUsdPrice)})`
  }

  const assetPerShare =
    pricePerShare > 0n ? formatTAmount({ value: pricePerShare, decimals: vaultDecimals, options: formatOpts }) : '0'
  const oneShareUsd = pricePerShare > 0n ? Number(formatUnits(pricePerShare, vaultDecimals)) * assetUsdPrice : 0
  return `1 vault share = ${assetPerShare} ${tokenLabel} (${formatUSD(oneShareUsd)})`
}

export const CollapsibleDetails: FC<CollapsibleDetailsProps> = ({
  pricePerShare,
  vaultDecimals,
  assetTokenSymbol,
  assetUsdPrice,
  variant,
  onSummaryClick,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const tokenLabel = assetTokenSymbol || 'token'
  const summaryLabel = formatExchangeRate(variant, pricePerShare, vaultDecimals, tokenLabel, assetUsdPrice)

  return (
    <div className="border border-border rounded-md px-4 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between h-5 w-full group"
        >
          <span
            onClick={
              onSummaryClick
                ? (e) => {
                    e.stopPropagation()
                    onSummaryClick()
                  }
                : undefined
            }
            className={cl(
              'text-sm text-text-secondary hover:text-text-primary transition-colors',
              onSummaryClick && 'yearn--link-dots'
            )}
          >
            {summaryLabel}
          </span>
          <IconChevron
            size={14}
            className={cl(
              'text-text-secondary group-hover:text-text-primary transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}
          />
        </button>

        <div
          className={cl(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 pt-2">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
