import { cl } from '@lib/utils'
import type { FC } from 'react'
import { Fragment } from 'react'

type TAPYSublineProps = {
  hasPendleArbRewards: boolean
  hasKelpNEngenlayer: boolean
  hasKelp: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
  isEligibleForSpectraBoost?: boolean
  onExtraRewardsClick?: () => void
}

export const APYSubline: FC<TAPYSublineProps> = ({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar,
  isEligibleForSpectraBoost,
  onExtraRewardsClick
}) => {
  // Handle single-line rewards first (they take priority and don't stack)
  if (hasKelpNEngenlayer) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-text-secondary self-end -mb-1')}>
        {'+1x Kelp Miles'}
        <br />
        {'+1x EigenLayer Points'}
      </small>
    )
  }
  if (hasKelp) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-text-secondary self-end -mb-1')}>{'+ 1x Kelp Miles'}</small>
    )
  }
  if (hasPendleArbRewards) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-text-secondary self-end -mb-1')}>{'+ 2500 ARB/week'}</small>
    )
  }

  // Handle stackable rewards (Spectra and Steer Points can both display)
  const hasSpectraBoost = isEligibleForSpectraBoost
  const hasSteerPoints = isEligibleForSteer && (steerPointsPerDollar || 0) > 0

  if (hasSpectraBoost || hasSteerPoints) {
    const LabelTag = onExtraRewardsClick ? 'button' : 'span'
    return (
      <LabelTag
        type={onExtraRewardsClick ? 'button' : undefined}
        className={cl(
          'whitespace-nowrap text-sm text-text-secondary self-end -mb-1',
          onExtraRewardsClick
            ? 'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:decoration-neutral-600'
            : undefined
        )}
        onClick={
          onExtraRewardsClick
            ? (event): void => {
                event.stopPropagation()
                onExtraRewardsClick()
              }
            : undefined
        }
      >
        {'Eligible for Extra Rewards'}
      </LabelTag>
    )
  }

  return <Fragment />
}
