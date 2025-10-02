import { cl, formatAmount } from '@lib/utils'
import type { FC } from 'react'
import { Fragment } from 'react'

type TAPYSublineProps = {
  hasPendleArbRewards: boolean
  hasKelpNEngenlayer: boolean
  hasKelp: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
  onMobileToggle?: boolean
}

export const APYSubline: FC<TAPYSublineProps> = ({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar,
  onMobileToggle,
}) => {
  if (hasKelpNEngenlayer) {
    return (
      <small
        className={cl(
          'whitespace-nowrap text-sm text-neutral-500 self-end -mb-1'
        )}
      >
        {'+1x Kelp Miles'}
        <br />
        {'+1x EigenLayer Points'}
      </small>
    )
  }
  if (hasKelp) {
    return (
      <small
        className={cl(
          'whitespace-nowrap text-sm text-neutral-500 self-end -mb-1'
        )}
      >
        {'+ 1x Kelp Miles'}
      </small>
    )
  }
  if (hasPendleArbRewards) {
    return (
      <small
        className={cl(
          'whitespace-nowrap text-sm text-neutral-500 self-end -mb-1'
        )}
      >
        {'+ 2500 ARB/week'}
      </small>
    )
  }
  if (isEligibleForSteer && (steerPointsPerDollar || 0) > 0) {
    return (
      <span className={'tooltip'}>
        <small
          className={cl(
            'whitespace-nowrap text-sm text-neutral-500 self-end -mb-1'
          )}
        >
          {'Eligible for Steer Points'}
        </small>
      </span>
    )
  }
  return <Fragment />
}
