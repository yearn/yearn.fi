import { Button } from '@shared/components/Button'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { formatAmount, formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'

type TRewardRowProps = {
  chainId: number
  tokenAddress: `0x${string}`
  symbol: string
  amount: string
  usdValue: number
  onClaim: () => void
  isClaimPending: boolean
  isClaimReady: boolean
  isLast?: boolean
}

function getTokenLogoUrl(chainId: number, tokenAddress: `0x${string}`): string {
  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-128.png`
}

export function RewardRow(props: TRewardRowProps): ReactElement {
  const { chainId, tokenAddress, symbol, amount, usdValue, onClaim, isClaimPending, isClaimReady, isLast } = props
  const borderClass = isLast ? '' : 'border-b border-border'

  return (
    <div className={`flex items-center justify-between py-2 ${borderClass}`}>
      <div className="flex items-center gap-2">
        <ImageWithFallback
          src={getTokenLogoUrl(chainId, tokenAddress)}
          alt={symbol}
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="font-medium text-text-primary">{symbol}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-medium text-text-primary">{formatAmount(amount, 2, 6)}</div>
          {usdValue > 0 && <div className="text-xs text-text-secondary">{formatUSD(usdValue, 2, 2)}</div>}
        </div>
        <Button
          onClick={onClaim}
          isDisabled={!isClaimReady}
          isBusy={isClaimPending}
          variant={isClaimReady ? 'filled' : 'light'}
          className="!px-3 !py-1.5 !text-xs"
          classNameOverride="yearn--button--nextgen"
        >
          Claim
        </Button>
      </div>
    </div>
  )
}
