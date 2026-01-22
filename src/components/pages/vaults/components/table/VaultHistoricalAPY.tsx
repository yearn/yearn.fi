import { KATANA_CHAIN_ID, SPECTRA_BOOST_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { getFixedTermMarkets } from '@pages/vaults/constants/fixedTermMarkets'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { Renderable } from '@shared/components/Renderable'
import { Tooltip } from '@shared/components/Tooltip'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconPendle } from '@shared/icons/IconPendle'
import { IconSpectra } from '@shared/icons/IconSpectra'
import { cl, formatAmount, isZero } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { getApySublineLines } from './APYSubline'
import { KatanaApyTooltipContent } from './KatanaApyTooltip'

export function VaultHistoricalAPY({
  currentVault,
  className,
  valueClassName
}: {
  currentVault: TYDaemonVault
  className?: string
  valueClassName?: string
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const shouldUseKatanaAPRs = currentVault.chainID === KATANA_CHAIN_ID
  const monthlyAPY = currentVault.apr.points.monthAgo
  const weeklyAPY = currentVault.apr.points.weekAgo
  const fixedTermMarkets = getFixedTermMarkets(currentVault.address)
  const fixedTermProviders = fixedTermMarkets.filter(
    (market, index, list) => list.findIndex((item) => item.provider === market.provider) === index
  )
  const fixedTermIcons = fixedTermProviders.map((market) => {
    const Icon = market.provider === 'pendle' ? IconPendle : IconSpectra
    return <Icon key={market.provider} className={'size-3.5'} />
  })
  const fixedTermProviderLabel = fixedTermProviders.map((market) => market.label).join(' & ')
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())
  const sublineLines = getApySublineLines({
    hasPendleArbRewards: data.hasPendleArbRewards,
    hasKelpNEngenlayer: data.hasKelpNEngenlayer,
    hasKelp: data.hasKelp,
    isEligibleForSteer: data.isEligibleForSteer,
    steerPointsPerDollar: data.steerPointsPerDollar,
    isEligibleForSpectraBoost
  })

  const katanaThirtyDayApr = data.katanaThirtyDayApr
  const hasKatanaApr = typeof katanaThirtyDayApr === 'number'
  const standardThirtyDayApr = isZero(monthlyAPY) ? weeklyAPY : monthlyAPY
  const displayValue = shouldUseKatanaAPRs ? (katanaThirtyDayApr ?? 0) : standardThirtyDayApr
  const shouldRenderValue = shouldUseKatanaAPRs ? hasKatanaApr : !currentVault.apr?.type.includes('new')
  const fallbackLabel = shouldUseKatanaAPRs ? '-' : 'NEW'
  const hasZeroAPY = isZero(displayValue || 0) || Number((displayValue || 0).toFixed(2)) === 0
  const showSublineTooltip = shouldUseKatanaAPRs
  const canOpenModal = shouldRenderValue
  const shouldShowKatanaAsterisk = shouldUseKatanaAPRs
  const tooltipUnderlineClass = shouldRenderValue
    ? 'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
    : undefined
  const valueInteractiveClass = shouldRenderValue ? 'cursor-pointer' : undefined
  const isKatanaVault = shouldUseKatanaAPRs && data.katanaExtras && hasKatanaApr

  const katanaTooltipContent =
    showSublineTooltip && isKatanaVault ? (
      <div className={'rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary'}>
        <div className={'flex items-center gap-2'}>
          <span aria-hidden>{'⚔️'}</span>
          <div className={'flex flex-col'}>
            <span>{'This Vault is receiving KAT incentives'}</span>
            <span>{'*There are conditions to earn this rate'}</span>
          </div>
        </div>
        {fixedTermProviders.length > 0 ? (
          <div className={'mt-1 flex items-center gap-3'}>
            <span className={'flex items-center gap-1 text-text-secondary'} aria-hidden={true}>
              {fixedTermIcons}
            </span>
            <span>{`Fixed-rate markets available on ${fixedTermProviderLabel}`}</span>
          </div>
        ) : null}
        {canOpenModal ? (
          <button
            type={'button'}
            data-tooltip-close={'true'}
            className={
              'mt-2 mx-auto block font-semibold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
            }
            onClick={(_event): void => {
              setIsModalOpen(true)
            }}
          >
            {'Click for more information'}
          </button>
        ) : null}
      </div>
    ) : null

  const boostTooltipLine =
    data.mode === 'boosted' && data.isBoosted ? `Boost ${formatAmount(data.boost || 0, 2, 2)}x` : null
  const fixedRateTooltipLines =
    fixedTermProviders.length > 0 && !isKatanaVault
      ? fixedTermProviders.map((market) => `Fixed-rate markets available on ${market.label}.`)
      : []
  const extraTooltipLines = showSublineTooltip ? [...sublineLines, ...fixedRateTooltipLines] : []
  const standardTooltipLines = [boostTooltipLine, ...extraTooltipLines].filter((line): line is string => Boolean(line))
  const standardTooltipContent =
    standardTooltipLines.length > 0 && (showSublineTooltip || Boolean(boostTooltipLine)) ? (
      <div className={'rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary'}>
        {standardTooltipLines.map((line, index) => (
          <div key={line} className={index === 0 ? '' : 'mt-1'}>
            {line}
          </div>
        ))}
        {showSublineTooltip && fixedTermProviders.length > 0 ? (
          <div className={'mt-2 flex flex-col gap-1'}>
            {fixedTermProviders.map((market) => (
              <a
                key={market.provider}
                href={market.marketUrl}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'inline-flex items-center gap-1 font-semibold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
                onClick={(event): void => event.stopPropagation()}
              >
                {`View ${market.label} market`}
                <IconLinkOut className={'size-3'} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    ) : null

  const infoTooltipContent = katanaTooltipContent ?? standardTooltipContent

  const modalTitle = shouldUseKatanaAPRs ? 'Katana 30 Day APY breakdown' : '30 Day APY breakdown'
  const modalContent =
    shouldUseKatanaAPRs && data.katanaExtras ? (
      <KatanaApyTooltipContent
        katanaNativeYield={data.katanaExtras.katanaNativeYield ?? 0}
        fixedRateKatanRewardsAPR={data.katanaExtras.FixedRateKatanaRewards ?? 0}
        katanaAppRewardsAPR={data.katanaExtras.katanaAppRewardsAPR ?? data.katanaExtras.katanaRewardsAPR ?? 0}
        katanaBonusAPR={data.katanaExtras.katanaBonusAPY ?? 0}
        steerPointsPerDollar={data.katanaExtras.steerPointsPerDollar}
        currentVault={currentVault}
        maxWidth={'w-full'}
      />
    ) : (
      <div
        className={
          'w-fit rounded-xl border border-border bg-surface-secondary p-4 text-center text-sm text-text-primary'
        }
      >
        <div
          className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
        >
          <p>{'30 Day APY '}</p>
          <span className={'font-number'}>
            <RenderAmount shouldHideTooltip value={displayValue || 0} symbol={'percent'} decimals={6} />
          </span>
        </div>
      </div>
    )

  const handleValueClick = (): void => {
    if (!shouldRenderValue) {
      return
    }
    setIsModalOpen(true)
  }

  const valueNode = (
    <b
      className={cl(
        'yearn--table-data-section-item-value relative inline-flex items-center gap-1',
        valueClassName,
        tooltipUnderlineClass,
        valueInteractiveClass
      )}
      onClick={handleValueClick}
    >
      <Renderable shouldRender={shouldRenderValue} fallback={fallbackLabel}>
        <RenderAmount shouldHideTooltip={hasZeroAPY} value={displayValue || 0} symbol={'percent'} decimals={6} />
      </Renderable>
      {shouldShowKatanaAsterisk ? (
        <span
          aria-hidden={true}
          className={'pointer-events-none absolute left-full -top-px ml-px text-sm text-text-secondary'}
        >
          {'*'}
        </span>
      ) : null}
    </b>
  )

  return (
    <Fragment>
      <div className={cl('flex flex-col items-end md:text-right', className)}>
        {shouldRenderValue && infoTooltipContent ? (
          <Tooltip
            className={'apy-subline-tooltip gap-0 h-auto md:justify-end'}
            openDelayMs={150}
            side={'bottom'}
            tooltip={infoTooltipContent}
          >
            {valueNode}
          </Tooltip>
        ) : (
          valueNode
        )}
      </div>
      <APYDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        {modalContent}
      </APYDetailsModal>
    </Fragment>
  )
}
