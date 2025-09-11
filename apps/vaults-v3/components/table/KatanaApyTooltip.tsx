import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'

export function KatanaApyTooltip(props: {
  extrinsicYield: number
  katanaNativeYield: number
  fixedRateKatanRewardsAPR: number
  katanaAppRewardsAPR: number
  katanaBonusAPR: number
  steerPointsPerDollar?: number
  position?: 'bottom' | 'top'
  maxWidth?: string
  currentVault: TYDaemonVault
}): ReactElement {
  const position = props.position || 'bottom'
  const positionClass = position === 'bottom' ? 'bottom-full' : 'top-full '
  const maxWidth = props.maxWidth || 'min-w-[360px] w-max'

  return (
    <span className={`tooltipLight ${positionClass}`}>
      <div
        className={`${maxWidth} rounded-xl border border-neutral-300 bg-neutral-200 p-4 text-center text-xs text-neutral-900`}
      >
        <div className={'flex flex-col items-start justify-start text-left'}>
          {/* Native APY */}
          <p
            className={
              'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            {'Native APY'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/${props.currentVault.chainID}/${props.currentVault.token.address}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Extrinsic Yield '}</p>
            </div>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={props.extrinsicYield} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Yield Earned from underlying bridged assets'}
          </p>

          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/${props.currentVault.chainID}/${props.currentVault.token.address}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Katana APY '}</p>
            </div>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={props.katanaNativeYield} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Yield Earned on Katana'}
          </p>

          <p className={'mb-2 w-full text-left text-xs italic text-neutral-500 break-words whitespace-normal'}>
            {'*This yield is guaranteed but may be paid in KAT tokens if actual rates are lower.'}
          </p>

          {/* Rewards APR */}
          <div className={'my-2 h-px w-full bg-neutral-300/60'} />
          <p
            className={
              'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold '
            }
          >
            {'Rewards APR'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Base Rewards APR '}</p>
            </div>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={props.fixedRateKatanRewardsAPR} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Limited time fixed KAT rewards'}
          </p>

          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'App Rewards APR '}</p>
            </div>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={props.katanaAppRewardsAPR} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Kat Rewards passed through from Apps'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700/35 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Deposit Bonus APR '}</p>
            </div>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={props.katanaBonusAPR} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <p className={'-mt-1 mb-0 w-full text-left text-xs text-neutral-700/35 break-words'}>
            {'Applied if you deposited before Sept. 1st and hold for 90 days'}
          </p>

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
    </span>
  )
}
