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
  sourceName?: string
  sourceTokenAddress?: `0x${string}`
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

function getTokenLogoUrl(chainId: number, tokenAddress: `0x${string}`): string {
  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-128.png`
}

function getChainLogoUrl(chainId: number): string {
  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo-32.png`
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
    sourceName,
    sourceTokenAddress,
    isAllChainsView,
    onSwitchChain
  } = props

  const isWrongChain = currentChainId !== chainId
  const showSwitchChainButton = isWrongChain && isAllChainsView && !!onSwitchChain
  const canClaim = isClaimReady && !isWrongChain

  function getButtonVariant(): 'filled' | 'light' {
    if (showSwitchChainButton) return 'light'
    if (canClaim) return 'filled'
    return 'light'
  }

  return (
    <div className="flex flex-col">
      {!isFirst && <div className="h-px w-full bg-border" />}
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {sourceTokenAddress && (
            <div className="relative flex size-8 shrink-0 items-center justify-center">
              <TokenLogo
                src={getTokenLogoUrl(chainId, sourceTokenAddress)}
                tokenSymbol={sourceName ?? symbol}
                width={32}
                height={32}
              />
              <div className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface">
                <TokenLogo src={getChainLogoUrl(chainId)} tokenSymbol="chain" width={14} height={14} />
              </div>
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
            {sourceName ?? symbol}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-medium text-text-primary">{formatAmount(amount, 2, 6)}</span>
            <TokenLogo src={getTokenLogoUrl(chainId, tokenAddress)} tokenSymbol={symbol} width={18} height={18} />
            <span className="text-base text-text-secondary">{symbol}</span>
            <span className="text-base text-text-secondary">({formatUSD(usdValue, 2, 2)})</span>
          </div>
          <Button
            onClick={showSwitchChainButton ? onSwitchChain : onClaim}
            isDisabled={!showSwitchChainButton && !canClaim}
            isBusy={isClaimPending}
            variant={getButtonVariant()}
            className="!px-4 !py-1.5 !text-sm"
            classNameOverride="yearn--button--nextgen"
          >
            {showSwitchChainButton ? 'Switch Chain' : 'Claim'}
          </Button>
        </div>
      </div>
    </div>
  )
}
