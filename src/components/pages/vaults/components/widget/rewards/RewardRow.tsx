import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { formatAmount, formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'

type TRewardRowProps = {
  chainId: number
  currentChainId: number
  tokenAddress: `0x${string}`
  symbol: string
  amount: string
  usdValue: number
  onClaim: () => void
  isClaimPending: boolean
  isClaimReady: boolean
  isFirst?: boolean
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

function getTokenLogoUrl(chainId: number, tokenAddress: `0x${string}`): string {
  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-128.png`
}

export function RewardRow(props: TRewardRowProps): ReactElement {
  const {
    chainId,
    currentChainId,
    tokenAddress,
    symbol,
    amount,
    usdValue,
    onClaim,
    isClaimPending,
    isClaimReady,
    isFirst,
    isAllChainsView,
    onSwitchChain
  } = props

  const isWrongChain = currentChainId !== chainId
  const showSwitchChainButton = isWrongChain && isAllChainsView && !!onSwitchChain
  const canClaim = isClaimReady && !isWrongChain

  const buttonVariant: 'filled' | 'light' = canClaim && !showSwitchChainButton ? 'filled' : 'light'

  return (
    <div className="flex flex-col">
      {!isFirst && <div className="h-px w-full bg-border" />}
      <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:flex-1 md:justify-start">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-text-primary">{formatAmount(amount, 2, 6)}</span>
            <span className="text-base text-text-secondary">({formatUSD(usdValue, 2, 2)})</span>
          </div>
          <div className="flex items-center gap-1.5 md:hidden">
            <span className="text-base text-text-secondary">{symbol}</span>
            <TokenLogo src={getTokenLogoUrl(chainId, tokenAddress)} tokenSymbol={symbol} width={18} height={18} />
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <span className="text-base text-text-secondary">{symbol}</span>
            <TokenLogo src={getTokenLogoUrl(chainId, tokenAddress)} tokenSymbol={symbol} width={18} height={18} />
          </div>
        </div>

        <div className="w-full md:w-auto md:shrink-0">
          <Button
            onClick={showSwitchChainButton ? onSwitchChain : onClaim}
            isDisabled={!showSwitchChainButton && !canClaim}
            isBusy={isClaimPending}
            variant={buttonVariant}
            classNameOverride="yearn--button--nextgen w-full md:w-auto"
          >
            {showSwitchChainButton ? 'Switch Chain' : 'Claim'}
          </Button>
        </div>
      </div>
    </div>
  )
}
