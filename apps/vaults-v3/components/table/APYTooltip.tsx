import { RenderAmount } from '@lib/components/RenderAmount';
import { formatAmount } from '@lib/utils';

import type { FC } from 'react';

type TAPYTooltipProps = {
  baseAPY: number;
  rewardsAPY?: number;
  boost?: number;
  range?: [number, number];
  hasPendleArbRewards?: boolean;
  hasKelpNEngenlayer?: boolean;
  hasKelp?: boolean;
};

export const APYTooltip: FC<TAPYTooltipProps> = ({
  baseAPY,
  rewardsAPY,
  boost,
  range,
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp
}) => {
  return (
    <span className={'tooltipLight bottom-full mb-1'}>
      <div className={'w-fit rounded-xl border border-neutral-300 bg-neutral-200 p-4 text-center text-sm text-neutral-900'}>
        <div className={'flex flex-col items-start justify-start text-left'}>
          <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
            <p>{'Base APY '}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={baseAPY} symbol={'percent'} decimals={6} />
            </span>
          </div>

          {rewardsAPY ? (
            <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
              <p>{'Rewards APR '}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={rewardsAPY} symbol={'percent'} decimals={6} />
              </span>
            </div>
          ) : null}

          {boost ? (
            <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
              <p>{'Boost '}</p>
              <p>
                <span className={'font-number'}>{formatAmount(boost, 2, 2)}</span>
                {' x'}
              </p>
            </div>
          ) : null}

          {range ? (
            <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
              <p>{'Rewards APR '}</p>
              <div>
                <span className={'font-number'}>
                  <RenderAmount shouldHideTooltip value={range[0]} symbol={'percent'} decimals={6} />
                </span>
                &nbsp;&rarr;&nbsp;
                <span className={'font-number'}>
                  <RenderAmount shouldHideTooltip value={range[1]} symbol={'percent'} decimals={6} />
                </span>
              </div>
            </div>
          ) : null}

          {hasPendleArbRewards ? (
            <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
              <p>{'Extra ARB '}</p>
              <p>{'2 500/week'}</p>
            </div>
          ) : null}

          {hasKelp ? (
            <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
              <p>{'Extra Kelp Miles '}</p>
              <p>{'1x'}</p>
            </div>
          ) : null}

          {hasKelpNEngenlayer ? (
            <>
              <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
                <p>{'Extra Kelp Miles '}</p>
                <p>{'1x'}</p>
              </div>
              <div className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-900 md:text-sm'}>
                <p>{'Extra EigenLayer Points '}</p>
                <p>{'1x'}</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </span>
  );
};

