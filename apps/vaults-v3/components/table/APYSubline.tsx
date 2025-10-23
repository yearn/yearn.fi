import { cl, formatAmount } from '@lib/utils'
import type { FC } from 'react'
import { Fragment } from 'react'

type TAPYSublineProps = {
  hasPendleArbRewards: boolean
  hasKelpNEngenlayer: boolean
  hasKelp: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
  isEligibleForSpectraBoost?: boolean
  onMobileToggle?: boolean
}

export const APYSubline: FC<TAPYSublineProps> = ({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar,
  isEligibleForSpectraBoost,
  onMobileToggle
}) => {
  // Handle single-line rewards first (they take priority and don't stack)
  if (hasKelpNEngenlayer) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-neutral-500 self-end -mb-1')}>
        {'+1x Kelp Miles'}
        <br />
        {'+1x EigenLayer Points'}
      </small>
    )
  }
  if (hasKelp) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-neutral-500 self-end -mb-1')}>{'+ 1x Kelp Miles'}</small>
    )
  }
  if (hasPendleArbRewards) {
    return (
      <small className={cl('whitespace-nowrap text-sm text-neutral-500 self-end -mb-1')}>{'+ 2500 ARB/week'}</small>
    )
  }

  // Handle stackable rewards (Spectra and Steer Points can both display)
  const hasSpectraBoost = isEligibleForSpectraBoost
  const hasSteerPoints = isEligibleForSteer && (steerPointsPerDollar || 0) > 0

  if (hasSpectraBoost || hasSteerPoints) {
    return (
      <div className={cl('flex flex-col gap-1 text-sm text-neutral-500 self-end -mb-1')}>
        {/* Spectra boost - show first */}
        {hasSpectraBoost && (
          <span className={'tooltip'}>
            <small
              className={cl(
                'whitespace-nowrap sm:underline sm:decoration-neutral-600/30 sm:decoration-dotted sm:underline-offset-4 transition-opacity sm:hover:decoration-neutral-600'
              )}
            >
              {'Boosted yield on Spectra'}
            </small>
            {!onMobileToggle && (
              <span className={'tooltipLight top-full right-0'}>
                <div
                  className={
                    'min-w-[360px] rounded-xl border border-neutral-300 bg-neutral-200 p-4 pb-1 text-center text-sm text-neutral-900'
                  }
                >
                  <p className={'-mt-1 mb-2 w-full text-left text-sm text-neutral-700 break-words whitespace-normal'}>
                    {'Earn boosted yield on Spectra if you '}
                    <a
                      href={'https://app.spectra.finance/pools'}
                      target={'_blank'}
                      rel={'noopener noreferrer'}
                      className={
                        'font-bold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 hover:decoration-neutral-600'
                      }
                    >
                      {'deposit to their protocol'}
                    </a>
                    {'.'}
                  </p>
                </div>
              </span>
            )}
          </span>
        )}

        {/* Steer Points - show second */}
        {hasSteerPoints && (
          <span className={'tooltip'}>
            <small
              className={cl(
                'whitespace-nowrap sm:underline sm:decoration-neutral-600/30 sm:decoration-dotted sm:underline-offset-4 transition-opacity sm:hover:decoration-neutral-600'
              )}
            >
              {'Eligible for Steer Points'}
            </small>
            {!onMobileToggle && (
              <span className={'tooltipLight top-full right-0'}>
                <div
                  className={
                    'min-w-[360px] rounded-xl border border-neutral-300 bg-neutral-200 p-4 pb-1 text-center text-sm text-neutral-900'
                  }
                >
                  <p className={'-mt-1 mb-2 w-full text-left text-sm text-neutral-700 break-words whitespace-normal'}>
                    {'This vault earns '}
                    <span className={'font-number'}>{formatAmount(steerPointsPerDollar || 0, 2, 2)}</span>
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
            )}
          </span>
        )}
      </div>
    )
  }

  return <Fragment />
}
