import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { Tooltip } from '@lib/components/Tooltip'
import { cl, formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { VAULT_ADDRESSES } from '../../constants/addresses'

type TKatanaTooltipProps = {
  extrinsicYield: number
  katanaNativeYield: number
  fixedRateKatanRewardsAPR: number
  katanaAppRewardsAPR: number
  katanaBonusAPR: number
  steerPointsPerDollar?: number
  isEligibleForSpectraBoost?: boolean
  position?: 'bottom' | 'top'
  maxWidth?: string
  className?: string
  currentVault: TYDaemonVault
  children?: ReactElement
}

export function KatanaApyTooltipContent({
  extrinsicYield,
  katanaNativeYield,
  fixedRateKatanRewardsAPR,
  katanaAppRewardsAPR,
  katanaBonusAPR,
  steerPointsPerDollar,
  isEligibleForSpectraBoost,
  maxWidth,
  currentVault
}: Omit<TKatanaTooltipProps, 'children' | 'position' | 'className'>): ReactElement {
  const width = maxWidth || 'w-full max-w-[360px]'

  const isTBillVault = currentVault.address.toLowerCase() === VAULT_ADDRESSES.AUSD.toLowerCase()
  const extrinsicYieldLabel = isTBillVault ? 'T-Bill Yield' : 'Extrinsic Yield'
  const extrinsicYieldDescription = isTBillVault
    ? 'Interest from U.S. treasury bills'
    : 'Yield Earned from underlying bridged assets'

  return (
    <div
      className={`${width} rounded-xl border border-border bg-surface-secondary p-4 text-center text-xs text-text-primary`}
    >
      <div className={'flex flex-col items-start justify-start text-left'}>
        {/* Native APY */}
        <p
          className={
            'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary md:text-sm text-bold pb-2'
          }
        >
          {'Native APY'}
        </p>
        <div
          className={
            'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-text-secondary md:text-sm text-bold pb-2'
          }
        >
          <div className={'flex flex-row items-center space-x-2'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                currentVault.chainID
              }/${currentVault.token.address.toLowerCase()}/logo-32.png`}
              alt={''}
              width={16}
              height={16}
            />
            <p>{extrinsicYieldLabel} </p>
          </div>
          <span className={'font-number text-right'}>
            <RenderAmount shouldHideTooltip value={extrinsicYield} symbol={'percent'} decimals={6} />
          </span>
        </div>
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {extrinsicYieldDescription}
        </p>
        <div
          className={
            'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-text-secondary md:text-sm text-bold pb-2'
          }
        >
          <div className={'flex flex-row items-center space-x-2'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                currentVault.chainID
              }/${currentVault.token.address.toLowerCase()}/logo-32.png`}
              alt={''}
              width={16}
              height={16}
            />
            <p>{'Katana APY '}</p>
          </div>
          <span className={'font-number text-right'}>
            <RenderAmount shouldHideTooltip value={katanaNativeYield} symbol={'percent'} decimals={6} />
          </span>
        </div>
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {'Yield Earned on Katana'}
        </p>
        <p className={'mb-2 w-full text-left text-xs italic text-text-secondary wrap-break-word whitespace-normal'}>
          {'*This yield is guaranteed but may be paid in KAT tokens if actual rates are lower.'}
        </p>
        {/* Rewards APR */}
        <div className={'my-2 h-px w-full bg-surface-tertiary/60'} />
        <p
          className={
            'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary md:text-sm text-bold '
          }
        >
          {'Rewards APR'}
        </p>
        <div
          className={
            'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-text-secondary md:text-sm text-bold pb-2'
          }
        >
          <div className={'flex flex-row items-center space-x-2'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`}
              alt={''}
              width={16}
              height={16}
            />
            <p>{'Base Rewards APR '}</p>
          </div>
          <span className={'font-number text-right'}>
            <RenderAmount shouldHideTooltip value={fixedRateKatanRewardsAPR} symbol={'percent'} decimals={6} />
          </span>
        </div>
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {'Limited time fixed KAT rewards'}
        </p>
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary break-words'}>
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
            'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-text-secondary md:text-sm text-bold pb-2'
          }
        >
          <div className={'flex flex-row items-center space-x-2'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`}
              alt={''}
              width={16}
              height={16}
            />
            <p>{'App Rewards APR '}</p>
          </div>
          <span className={'font-number text-right'}>
            <RenderAmount shouldHideTooltip value={katanaAppRewardsAPR} symbol={'percent'} decimals={6} />
          </span>
        </div>
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {'Kat Rewards passed through from Apps'}
        </p>
        <div
          className={
            'flex w-full flex-row items-start justify-between gap-3 whitespace-normal text-text-secondary/35 md:text-sm text-bold pb-2'
          }
        >
          <div className={'flex flex-row items-center space-x-2'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`}
              alt={''}
              width={16}
              height={16}
            />
            <p>{'Deposit Bonus APR '}</p>
          </div>
          <span className={'font-number text-right'}>
            <RenderAmount shouldHideTooltip value={katanaBonusAPR} symbol={'percent'} decimals={6} />
          </span>
        </div>
        <p className={'-mt-1 mb-0 w-full text-left text-xs text-text-secondary/35 wrap-break-word'}>
          {'Applied if you deposited before Sept. 1st and hold for 90 days'}
        </p>

        <div className={'mt-2 p-3 pb-0 text-text-secondary md:text-xs text-bold'}>
          <li className={'-mt-1 mb-2 w-full text-left wrap-break-word'}>
            {'KAT tokens are locked until no later than Feb. 20 2026.'}
          </li>
          <li className={'-mt-1 mb-2 w-full text-left wrap-break-word'}>
            {'KAT APR is calculated using an assumed $1B Fully Diluted Valuation.'}
          </li>
          <li className={'-mt-1 mb-2 w-full text-left wrap-break-word'}>
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
        {isEligibleForSpectraBoost && (
          <>
            <div className={'my-2 h-px w-full bg-surface-tertiary/60'} />
            <p
              className={
                'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary md:text-sm text-bold pb-2'
              }
            >
              {'Earn Boosted Yield with Spectra'}
            </p>
            <p className={'-mt-1 mb-2 w-full text-left text-sm text-text-secondary wrap-break-word whitespace-normal'}>
              {'Earn boosted yield on Spectra if you '}
              <a
                href={'https://app.spectra.finance/pools?networks=katana'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                {'deposit to their protocol'}
              </a>
              {'.'}
            </p>
          </>
        )}
        {steerPointsPerDollar && steerPointsPerDollar > 0 ? (
          <>
            <div className={'my-2 h-px w-full bg-surface-tertiary/60'} />
            <p
              className={
                'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary md:text-sm text-bold pb-2'
              }
            >
              {'Steer Points'}
            </p>
            <p className={'-mt-1 mb-2 w-full text-left text-sm text-text-secondary wrap-break-word whitespace-normal'}>
              {'This vault earns '}
              <span className={'font-number'}>{formatAmount(steerPointsPerDollar, 2, 2)}</span>
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
  )
}

export function KatanaApyTooltip(props: TKatanaTooltipProps): ReactElement {
  return (
    <Tooltip className={cl('gap-0 h-auto', props.className)} tooltip={<KatanaApyTooltipContent {...props} />}>
      {props.children as ReactElement}
    </Tooltip>
  )
}
