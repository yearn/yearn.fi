import { RenderAmount } from '@lib/components/RenderAmount'
import { cl } from '@lib/utils'
import type { FC } from 'react'
import { Fragment } from 'react'

type TAPYSublineProps = {
  hasPendleArbRewards: boolean
  hasKelpNEngenlayer: boolean
  hasKelp: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
}

export const APYSubline: FC<TAPYSublineProps> = ({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar
}) => {
  if (hasKelpNEngenlayer) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>
        {'+1x Kelp Miles'}
        <br />
        {'+1x EigenLayer Points'}
      </small>
    )
  }
  if (hasKelp) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>{'+ 1x Kelp Miles'}</small>
    )
  }
  if (hasPendleArbRewards) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>{'+ 2500 ARB/week'}</small>
    )
  }
  if (isEligibleForSteer && (steerPointsPerDollar || 0) > 0) {
    return (
      <span className={'tooltip'}>
        <small
          className={cl(
            'whitespace-nowrap text-xs text-neutral-500 self-end -mb-1 underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
          )}
        >
          {'Eligible for Steer Points'}
        </small>
        <span className={'tooltipLight top-full left-4 '}>
          <div
            className={
              'font-number min-w-[360px] rounded-xl border border-neutral-300 bg-neutral-100 p-4 pb-1 text-center text-xxs text-neutral-900'
            }
          >
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-700 break-words whitespace-normal'}>
              {'This vault earns '}
              <RenderAmount shouldHideTooltip value={steerPointsPerDollar || 0} symbol={'percent'} decimals={6} />
              {' Steer Points / dollar deposited, but you must '}
              <a
                href={'https://app.steer.finance/points'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'font-bold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 hover:decoration-neutral-600'
                }
              >
                {'register here to earn them.'}
              </a>
            </p>
          </div>
        </span>
      </span>
    )
  }
  return <Fragment />
}
