import { getVaultChainID, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { Tooltip } from '@shared/components/Tooltip'
import { cl, formatAmount, formatApyDisplay } from '@shared/utils'
import type { ReactElement } from 'react'

type TKatanaTooltipProps = {
  katanaNativeYield: number
  fixedRateKatanRewardsAPR: number
  katanaAppRewardsAPR: number
  steerPointsPerDollar?: number
  isEligibleForSpectraBoost?: boolean
  nativeYieldLabel?: string
  position?: 'bottom' | 'top'
  maxWidth?: string
  className?: string
  currentVault: TKongVaultInput
  children?: ReactElement
}

const KATANA_LINK_CLASS =
  'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 ' +
  'transition-opacity hover:decoration-neutral-600'
const KATANA_SECONDARY_LINK_CLASS =
  'font-bold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 hover:decoration-neutral-600'
const KATANA_SECTION_TITLE_CLASS =
  'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-text-secondary ' +
  'md:text-sm text-bold pb-2'

type TKatanaApyRowProps = {
  iconSrc: string
  label: string
  value: number
}

function KatanaApyRow({ iconSrc, label, value }: TKatanaApyRowProps): ReactElement {
  return (
    <div
      className={
        'flex w-full flex-row items-start justify-between gap-3 whitespace-normal pb-2 text-text-secondary md:text-sm text-bold'
      }
    >
      <div className={'flex flex-row items-center space-x-2'}>
        <ImageWithFallback src={iconSrc} alt={''} width={16} height={16} />
        <p>{label}</p>
      </div>
      <span className={'font-number text-right'}>{formatApyDisplay(value)}</span>
    </div>
  )
}

export function KatanaApyTooltipContent({
  katanaNativeYield,
  fixedRateKatanRewardsAPR,
  katanaAppRewardsAPR,
  steerPointsPerDollar,
  isEligibleForSpectraBoost,
  nativeYieldLabel,
  maxWidth,
  currentVault
}: Omit<TKatanaTooltipProps, 'children' | 'position' | 'className'>): ReactElement {
  const width = maxWidth || 'w-full max-w-[360px]'
  const resolvedNativeYieldLabel = nativeYieldLabel ?? 'Katana Native 30 Day APY'
  const baseAssetsUrl = import.meta.env.VITE_BASE_YEARN_ASSETS_URI
  const chainId = getVaultChainID(currentVault)
  const tokenAddress = getVaultToken(currentVault).address.toLowerCase()
  const tokenLogoSrc = `${baseAssetsUrl}/tokens/${chainId}/${tokenAddress}/logo-32.png`
  const chainLogoSrc = `${baseAssetsUrl}/chains/${chainId}/logo-32.png`
  const hasFixedRateRewards = fixedRateKatanRewardsAPR > 0
  const hasAppRewards = katanaAppRewardsAPR > 0
  const hasSteerPoints = (steerPointsPerDollar || 0) > 0

  return (
    <div
      className={cl(
        width,
        'rounded-lg border border-border bg-surface-secondary p-4 text-center text-xs text-text-primary'
      )}
    >
      <div className={'flex flex-col items-start justify-start text-left'}>
        <KatanaApyRow iconSrc={tokenLogoSrc} label={`${resolvedNativeYieldLabel} `} value={katanaNativeYield} />
        <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {'Yield Earned on Katana'}
        </p>
        {hasFixedRateRewards ? (
          <>
            <KatanaApyRow iconSrc={chainLogoSrc} label={'Base Rewards APR '} value={fixedRateKatanRewardsAPR} />
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
              {'Limited time KAT rewards'}
            </p>
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary break-words'}>
              {'* claimable after 28 days, subject to '}
              <a
                href={'https://x.com/katana/status/1961475531188126178'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={KATANA_LINK_CLASS}
              >
                {'haircut schedule.'}
              </a>
            </p>
          </>
        ) : null}
        {hasAppRewards ? (
          <>
            <KatanaApyRow iconSrc={chainLogoSrc} label={'App Rewards APR '} value={katanaAppRewardsAPR} />
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
              {'KAT rewards passed through from apps'}
            </p>
          </>
        ) : null}
        {/* keeping the section below as we will probably need it soon */}
        {/* <p className={'mt-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {
            'In order to claim all KAT rewards earned before TGE, users must remain in the vault for 30 days, until April 18th, 2026.'
          }
        </p> */}
        <p className={'mt-2 w-full text-left text-xs text-text-secondary wrap-break-word'}>
          {'Read more about KAT tokenomics '}
          <a
            href={'https://katana.network/blog/the-network-is-katana-the-token-is-kat'}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className={KATANA_LINK_CLASS}
          >
            {'here.'}
          </a>
        </p>
        {isEligibleForSpectraBoost && (
          <>
            <div className={'my-2 h-px w-full bg-surface-tertiary/60'} />
            <p className={KATANA_SECTION_TITLE_CLASS}>{'Earn Boosted Yield with Spectra'}</p>
            <p className={'-mt-1 mb-2 w-full text-left text-sm text-text-secondary wrap-break-word whitespace-normal'}>
              {'Earn boosted yield on Spectra if you '}
              <a
                href={'https://app.spectra.finance/pools?networks=katana'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={KATANA_LINK_CLASS}
              >
                {'deposit to their protocol'}
              </a>
              {'.'}
            </p>
          </>
        )}
        {hasSteerPoints ? (
          <>
            <div className={'my-2 h-px w-full bg-surface-tertiary/60'} />
            <p className={KATANA_SECTION_TITLE_CLASS}>{'Steer Points'}</p>
            <p className={'-mt-1 mb-2 w-full text-left text-sm text-text-secondary wrap-break-word whitespace-normal'}>
              {'This vault earns '}
              <span className={'font-number'}>{formatAmount(steerPointsPerDollar || 0, 2, 2)}</span>
              {' Steer Points / dollar deposited, but you must '}
              <a
                href={'https://app.steer.finance/points'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={KATANA_SECONDARY_LINK_CLASS}
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
