import { useClaimYieldSplitterRewards } from '@pages/vaults/hooks/rewards/useClaimYieldSplitterRewards'
import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useChainId } from '@shared/hooks/useAppWagmi'
import { toNormalizedValue } from '@shared/utils'
import { formatAmount, formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import { useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import type { TStakingReward } from './types'
import { buildYieldSplitterClaimCopy } from './YieldSplitterRewardRow.utils'

type TYieldSplitterRewardRowProps = {
  rewards: TStakingReward[]
  splitterAddress: `0x${string}`
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
}

export function YieldSplitterRewardRow(props: TYieldSplitterRewardRowProps): ReactElement {
  const { rewards, splitterAddress, chainId, onStartClaim, isFirst } = props
  const currentChainId = useChainId()
  const { isPending } = useWriteContract()

  const hasClaimableRewards = rewards.some((reward) => reward.amount > 0n)
  const { prepare } = useClaimYieldSplitterRewards({
    splitterAddress,
    chainId,
    enabled: hasClaimableRewards
  })

  const normalizedRewards = useMemo(
    () =>
      rewards.map((reward) => ({
        ...reward,
        normalizedAmount: toNormalizedValue(reward.amount, reward.decimals)
      })),
    [rewards]
  )

  const totalUsd = useMemo(
    () => normalizedRewards.reduce((total, reward) => total + reward.usdValue, 0),
    [normalizedRewards]
  )

  const claimCopy = useMemo(() => buildYieldSplitterClaimCopy(rewards), [rewards])

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }

    return {
      prepare,
      label: 'Claim',
      confirmMessage: claimCopy.confirmMessage,
      successTitle: 'Rewards Claimed',
      successMessage: claimCopy.successMessage,
      showConfetti: true
    }
  }, [claimCopy.confirmMessage, claimCopy.successMessage, prepare])

  const handleClaim = useCallback(() => {
    if (!step) {
      return
    }
    onStartClaim(step)
  }, [onStartClaim, step])

  const isWrongChain = currentChainId !== chainId
  const canClaim = prepare.isSuccess && !isWrongChain

  const getTokenLogoUrl = useCallback(
    (tokenAddress: `0x${string}`) =>
      `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-128.png`,
    [chainId]
  )

  return (
    <div className="flex flex-col">
      {!isFirst && <div className="h-px w-full bg-border" />}
      <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-col gap-2 md:flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-text-primary">{formatUSD(totalUsd, 2, 2)}</span>
            {rewards.length > 1 ? (
              <span className="text-sm text-text-secondary">{`${rewards.length} reward tokens`}</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {normalizedRewards.map((reward) => (
              <div key={`${reward.tokenAddress}-${reward.amount}`} className="flex items-center gap-1.5">
                <span className="text-base font-bold text-text-primary">
                  {formatAmount(reward.normalizedAmount.toString(), 2, 6)}
                </span>
                <span className="text-base text-text-secondary">{reward.symbol}</span>
                <TokenLogo
                  src={getTokenLogoUrl(reward.tokenAddress)}
                  tokenSymbol={reward.symbol}
                  width={18}
                  height={18}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="w-full md:w-auto md:shrink-0">
          <Button
            onClick={handleClaim}
            isDisabled={!canClaim}
            isBusy={isPending}
            variant={canClaim ? 'filled' : 'light'}
            classNameOverride="yearn--button--nextgen w-full md:w-auto"
          >
            {claimCopy.ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
