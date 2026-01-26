import { Tooltip } from '@shared/components/Tooltip'
import { formatAmount, formatApyDisplay } from '@shared/utils'

import type { FC, ReactElement } from 'react'

type TAPYTooltipProps = {
  baseAPY: number
  rewardsAPY?: number
  boost?: number
  range?: [number, number]
  hasPendleArbRewards?: boolean
  hasKelpNEngenlayer?: boolean
  hasKelp?: boolean
  children?: ReactElement
}

export function APYTooltipContent({
  baseAPY,
  rewardsAPY,
  boost,
  range,
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp
}: Omit<TAPYTooltipProps, 'children'>): ReactElement {
  return (
    <div
      className={'w-fit rounded-lg border border-border bg-surface-secondary p-4 text-center text-sm text-text-primary'}
    >
      <div className={'flex flex-col items-start justify-start text-left'}>
        <div
          className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
        >
          <p>{'Base APY '}</p>
          <span className={'font-number'}>{formatApyDisplay(baseAPY)}</span>
        </div>

        {rewardsAPY ? (
          <div
            className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
          >
            <p>{'Rewards APR '}</p>
            <span className={'font-number'}>{formatApyDisplay(rewardsAPY)}</span>
          </div>
        ) : null}

        {boost ? (
          <div
            className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
          >
            <p>{'Boost '}</p>
            <p>
              <span className={'font-number'}>{formatAmount(boost, 2, 2)}</span>
              {' x'}
            </p>
          </div>
        ) : null}

        {range ? (
          <div
            className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
          >
            <p>{'Rewards APR '}</p>
            <div>
              <span className={'font-number'}>{formatApyDisplay(range[0])}</span>
              &nbsp;&rarr;&nbsp;
              <span className={'font-number'}>{formatApyDisplay(range[1])}</span>
            </div>
          </div>
        ) : null}

        {hasPendleArbRewards ? (
          <div
            className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
          >
            <p>{'Extra ARB '}</p>
            <p>{'2 500/week'}</p>
          </div>
        ) : null}

        {hasKelp ? (
          <div
            className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
          >
            <p>{'Extra Kelp Miles '}</p>
            <p>{'1x'}</p>
          </div>
        ) : null}

        {hasKelpNEngenlayer ? (
          <>
            <div
              className={
                'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'
              }
            >
              <p>{'Extra Kelp Miles '}</p>
              <p>{'1x'}</p>
            </div>
            <div
              className={
                'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'
              }
            >
              <p>{'Extra EigenLayer Points '}</p>
              <p>{'1x'}</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export const APYTooltip: FC<TAPYTooltipProps> = ({ children, ...rest }) => {
  return <Tooltip tooltip={<APYTooltipContent {...rest} />}>{children as ReactElement}</Tooltip>
}
