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

export function getApySublineLines({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar,
  isEligibleForSpectraBoost
}: Omit<TAPYSublineProps, 'onExtraRewardsClick'>): string[] {
  if (hasKelpNEngenlayer) {
    return ['+1x Kelp Miles', '+1x EigenLayer Points']
  }
  if (hasKelp) {
    return ['+ 1x Kelp Miles']
  }
  if (hasPendleArbRewards) {
    return ['+ 2500 ARB/week']
  }

  const hasSpectraBoost = isEligibleForSpectraBoost
  const hasSteerPoints = isEligibleForSteer && (steerPointsPerDollar || 0) > 0

  if (hasSpectraBoost || hasSteerPoints) {
    return ['Eligible for Extra Rewards']
  }

  return []
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
  const lines = getApySublineLines({
    hasPendleArbRewards,
    hasKelpNEngenlayer,
    hasKelp,
    isEligibleForSteer,
    steerPointsPerDollar,
    isEligibleForSpectraBoost
  })

  if (lines.length === 0) {
    return <Fragment />
  }

  if (lines.length === 1 && lines[0] === 'Eligible for Extra Rewards') {
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
        {lines[0]}
      </LabelTag>
    )
  }

  return (
    <small className={cl('whitespace-nowrap text-sm text-text-secondary self-end -mb-1')}>
      {lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </small>
  )
}
