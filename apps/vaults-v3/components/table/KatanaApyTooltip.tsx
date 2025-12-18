import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { Tooltip } from '@lib/components/Tooltip'
import { cl, formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'

export function KatanaApyTooltip(props: {
  katanaNativeYield: number
  fixedRateKatanRewardsAPR: number
  katanaAppRewardsAPR: number
  katanaBonusAPR: number
  steerPointsPerDollar?: number
  position?: 'bottom' | 'top'
  maxWidth?: string
  className?: string
  currentVault: TYDaemonVault
  children: ReactElement
}): ReactElement {
  const maxWidth = props.maxWidth || 'w-full max-w-[360px]'

  return (
    <Tooltip
      className={cl('gap-0 h-auto', props.className)}
      tooltip={
        <div
          className={`${maxWidth} rounded-xl border border-neutral-300 bg-neutral-200 p-4 text-center text-xs text-neutral-900`}
        >
          <div className={'flex flex-col items-start justify-start text-left'}>
            <div
              className={
                'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-neutral-700 md:text-sm text-bold pb-2'
              }
            >
              <div className={'flex flex-row items-center space-x-2'}>
                <ImageWithFallback
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                    props.currentVault.chainID
                  }/${props.currentVault.token.address.toLowerCase()}/logo-32.png`}
                  alt={''}
                  width={16}
                  height={16}
                />
                <p>{'Katana Native APY '}</p>
              </div>
              <span className={'font-number text-right'}>
                <RenderAmount shouldHideTooltip value={props.katanaNativeYield} symbol={'percent'} decimals={6} />
              </span>
            </div>
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
              {'Yield Earned on Katana'}
            </p>
            <div
              className={
                'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-neutral-700 md:text-sm text-bold pb-2'
              }
            >
              <div className={'flex flex-row items-center space-x-2'}>
                <ImageWithFallback
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${props.currentVault.chainID}/logo-32.png`}
                  alt={''}
                  width={16}
                  height={16}
                />
                <p>{'Base Rewards APR* '}</p>
              </div>
              <span className={'font-number text-right'}>
                <RenderAmount
                  shouldHideTooltip
                  value={props.fixedRateKatanRewardsAPR}
                  symbol={'percent'}
                  decimals={6}
                />
              </span>
            </div>
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
              {'Limited time fixed KAT rewards'}
            </p>
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
              {'* claimable after 28 days, subject to '}
              <a
                href={'https://x.com/katana/status/1961475531188126178'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                {'haircut schedule.'}
              </a>
            </p>
            <div
              className={
                'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-neutral-700 md:text-sm text-bold pb-2'
              }
            >
              <div className={'flex flex-row items-center space-x-2'}>
                <ImageWithFallback
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${props.currentVault.chainID}/logo-32.png`}
                  alt={''}
                  width={16}
                  height={16}
                />
                <p>{'App Rewards APR '}</p>
              </div>
              <span className={'font-number text-right'}>
                <RenderAmount shouldHideTooltip value={props.katanaAppRewardsAPR} symbol={'percent'} decimals={6} />
              </span>
            </div>
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
              {'Kat Rewards passed through from Apps'}
            </p>
            <div
              className={
                'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-neutral-700/35 md:text-sm text-bold pb-2'
              }
            >
              <div className={'flex flex-row items-center space-x-2'}>
                <ImageWithFallback
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${props.currentVault.chainID}/logo-32.png`}
                  alt={''}
                  width={16}
                  height={16}
                />
                <p>{'Deposit Bonus APR '}</p>
              </div>
              <span className={'font-number text-right'}>
                <RenderAmount shouldHideTooltip value={props.katanaBonusAPR} symbol={'percent'} decimals={6} />
              </span>
            </div>
            <p className={'-mt-1 mb-0 w-full text-left text-xs text-neutral-700/35 break-words'}>
              {'Applied if you deposited before Sept. 1st and hold for 90 days'}
            </p>

            <div className={'mt-2 p-3 pb-0 text-neutral-700 md:text-xs text-bold'}>
              <li className={'-mt-1 mb-2 w-full text-left break-words'}>
                {'KAT tokens are locked until no later than Feb. 20 2026.'}
              </li>
              <li className={'-mt-1 mb-2 w-full text-left break-words'}>
                {'KAT APR is calculated using an assumed $1B Fully Diluted Valuation.'}
              </li>
              <li className={'-mt-1 mb-2 w-full text-left break-words'}>
                {'Read more about KAT tokenomics '}
                <a
                  href={'https://katana.network/blog/the-network-is-katana-the-token-is-kat'}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={
                    'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  {'here.'}
                </a>
              </li>
            </div>
            {/* Steer Points (metadata) */}
            {props.steerPointsPerDollar && props.steerPointsPerDollar > 0 ? (
              <>
                <div className={'my-2 h-px w-full bg-neutral-300/60'} />
                <p
                  className={
                    'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold pb-2'
                  }
                >
                  {'Steer Points'}
                </p>
                <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-700 break-words whitespace-normal'}>
                  {'This vault earns '}
                  <span className={'font-number'}>{formatAmount(props.steerPointsPerDollar, 2, 2)}</span>
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
              </>
            ) : null}
          </div>
        </div>
      }
    >
      {props.children}
    </Tooltip>
  )
}
