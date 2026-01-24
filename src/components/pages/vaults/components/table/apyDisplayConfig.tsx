import { KATANA_CHAIN_ID, SPECTRA_BOOST_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { getFixedTermMarkets, type TFixedTermMarket } from '@pages/vaults/constants/fixedTermMarkets'
import type { TVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconPendle } from '@shared/icons/IconPendle'
import { IconSpectra } from '@shared/icons/IconSpectra'
import { formatAmount, isZero } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'
import { APYSubline, getApySublineLines } from './APYSubline'
import { APYTooltipContent } from './APYTooltip'
import type { TApyDisplayConfig, TApyTooltipConfig, TApyTooltipMode } from './ApyDisplay'
import { KatanaApyTooltipContent } from './KatanaApyTooltip'
import type { TVaultForwardAPYVariant } from './VaultForwardAPY'

const DEFAULT_TOOLTIP_CLASS = 'apy-subline-tooltip gap-0 h-auto md:justify-end'
const DEFAULT_TOOLTIP_DELAY = 150
const FIXED_RATE_LINK_CLASS =
  'inline-flex items-center gap-1 font-semibold underline decoration-neutral-600/30 decoration-dotted ' +
  'underline-offset-4 transition-opacity hover:decoration-neutral-600'
const KATANA_TOOLTIP_CTA_CLASS =
  'mt-2 mx-auto block font-semibold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 ' +
  'transition-opacity hover:decoration-neutral-600'

export type TApyModalConfig = {
  title: string
  content: ReactNode
  canOpen: boolean
}

type TFixedTermContext = {
  fixedTermProviders: TFixedTermMarket[]
  fixedTermIcons: ReactElement[]
  fixedTermIndicator: ReactElement | null
  fixedTermProviderLabel: string
}

type TStandardTooltipOptions = {
  lines: string[]
  fixedTermProviders: TFixedTermMarket[]
  showFixedRateLinks: boolean
}

type TKatanaTooltipOptions = {
  fixedTermProviders: TFixedTermMarket[]
  fixedTermIcons: ReactElement[]
  fixedTermProviderLabel: string
  showModalCTA: boolean
  onRequestModalOpen?: () => void
}

type TApySublineConfig = Parameters<typeof getApySublineLines>[0]

function buildSubline(config: TApySublineConfig, shouldRender: boolean): ReactNode {
  if (!shouldRender) {
    return null
  }
  return <APYSubline {...config} />
}

function withTooltipMode(config: TApyTooltipConfig, mode: TApyTooltipMode): TApyTooltipConfig {
  return { ...config, mode }
}

export function buildFixedTermContext(currentVault: TYDaemonVault): TFixedTermContext {
  const fixedTermMarkets = getFixedTermMarkets(currentVault.address)
  const fixedTermProviders = fixedTermMarkets.filter(
    (market, index, list) => list.findIndex((item) => item.provider === market.provider) === index
  )
  const fixedTermIcons = fixedTermProviders.map((market) => {
    const Icon = market.provider === 'pendle' ? IconPendle : IconSpectra
    return <Icon key={market.provider} className={'size-3.5'} />
  })
  const fixedTermProviderLabel = fixedTermProviders.map((market) => market.label).join(' & ')
  const fixedTermIndicator =
    fixedTermProviders.length > 0 ? (
      <span className={'flex items-center gap-1 text-text-secondary'} aria-hidden={true}>
        {fixedTermIcons}
      </span>
    ) : null

  return {
    fixedTermProviders,
    fixedTermIcons,
    fixedTermIndicator,
    fixedTermProviderLabel
  }
}

function buildStandardTooltipContent({
  lines,
  fixedTermProviders,
  showFixedRateLinks
}: TStandardTooltipOptions): ReactElement | null {
  if (lines.length === 0) {
    return null
  }

  return (
    <div className={'rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary'}>
      {lines.map((line, index) => (
        <div key={line} className={index === 0 ? '' : 'mt-1'}>
          {line}
        </div>
      ))}
      {showFixedRateLinks && fixedTermProviders.length > 0 ? (
        <div className={'mt-2 flex flex-col gap-1'}>
          {fixedTermProviders.map((market) => (
            <a
              key={market.provider}
              href={market.marketUrl}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={FIXED_RATE_LINK_CLASS}
              onClick={(event): void => event.stopPropagation()}
            >
              {`View ${market.label} market`}
              <IconLinkOut className={'size-3'} />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function buildKatanaTooltipContent({
  fixedTermProviders,
  fixedTermIcons,
  fixedTermProviderLabel,
  showModalCTA,
  onRequestModalOpen
}: TKatanaTooltipOptions): ReactElement {
  return (
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
      {showModalCTA ? (
        <button
          type={'button'}
          data-tooltip-close={'true'}
          className={KATANA_TOOLTIP_CTA_CLASS}
          onClick={(): void => onRequestModalOpen?.()}
        >
          {'Click for more information'}
        </button>
      ) : null}
    </div>
  )
}

function resolveTooltipMode(allowModal: boolean, hasTooltipContent: boolean): TApyTooltipMode {
  if (allowModal) {
    return 'tooltip+modal'
  }
  return hasTooltipContent ? 'tooltip' : 'none'
}

type TForwardApyDisplayParams = {
  currentVault: TYDaemonVault
  data: TVaultApyData
  displayVariant: TVaultForwardAPYVariant
  showSubline: boolean
  showSublineTooltip: boolean
  showBoostDetails: boolean
  canOpenModal: boolean
  onRequestModalOpen?: () => void
}

export function resolveForwardApyDisplayConfig({
  currentVault,
  data,
  displayVariant,
  showSubline,
  showSublineTooltip,
  showBoostDetails,
  canOpenModal,
  onRequestModalOpen
}: TForwardApyDisplayParams): {
  displayConfig: TApyDisplayConfig
  modalConfig?: TApyModalConfig
} {
  const fixedTermContext = buildFixedTermContext(currentVault)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())
  const baseSublineProps: TApySublineConfig = {
    hasPendleArbRewards: data.hasPendleArbRewards,
    hasKelpNEngenlayer: data.hasKelpNEngenlayer,
    hasKelp: data.hasKelp,
    isEligibleForSteer: data.isEligibleForSteer,
    steerPointsPerDollar: data.steerPointsPerDollar,
    isEligibleForSpectraBoost
  }
  const sublineLines = getApySublineLines(baseSublineProps)
  const standardSubline = buildSubline(baseSublineProps, showSubline)
  const katanaSubline = buildSubline(
    {
      ...baseSublineProps,
      hasPendleArbRewards: false,
      hasKelpNEngenlayer: false,
      hasKelp: false
    },
    showSubline
  )
  const shouldRenderForward = !currentVault.apr.forwardAPR?.type.includes('new')
  const shouldRenderHistorical = !currentVault.apr.type.includes('new')
  const fixedRateTooltipLines =
    fixedTermContext.fixedTermProviders.length > 0
      ? fixedTermContext.fixedTermProviders.map((market) => `Fixed-rate markets available on ${market.label}.`)
      : []

  const boostTooltipLine =
    showBoostDetails && displayVariant !== 'factory-list' && data.mode === 'boosted' && data.isBoosted
      ? `Boost ${formatAmount(data.boost || 0, 2, 2)}x`
      : null
  const allowTooltip = showSublineTooltip || Boolean(boostTooltipLine)
  const extraTooltipLines = showSublineTooltip ? [...sublineLines, ...fixedRateTooltipLines] : []
  const standardTooltipLines = [boostTooltipLine, ...extraTooltipLines].filter((line): line is string => Boolean(line))
  const standardTooltipContent = buildStandardTooltipContent({
    lines: standardTooltipLines,
    fixedTermProviders: fixedTermContext.fixedTermProviders,
    showFixedRateLinks: showSublineTooltip && fixedTermContext.fixedTermProviders.length > 0
  })

  const katanaExtras = data.katanaExtras
  const hasKatanaEstApr = typeof data.katanaEstApr === 'number'
  const isKatanaVault = currentVault.chainID === KATANA_CHAIN_ID && katanaExtras && hasKatanaEstApr
  const katanaTooltipContent =
    showSublineTooltip && isKatanaVault
      ? buildKatanaTooltipContent({
          fixedTermProviders: fixedTermContext.fixedTermProviders,
          fixedTermIcons: fixedTermContext.fixedTermIcons,
          fixedTermProviderLabel: fixedTermContext.fixedTermProviderLabel,
          showModalCTA: canOpenModal,
          onRequestModalOpen
        })
      : null
  const tooltipContent = katanaTooltipContent ?? standardTooltipContent

  const fixedRateIndicator = fixedTermContext.fixedTermIndicator
  const baseTooltipConfig: TApyTooltipConfig = {
    mode: 'none',
    content: tooltipContent,
    className: DEFAULT_TOOLTIP_CLASS,
    openDelayMs: DEFAULT_TOOLTIP_DELAY,
    align: 'center',
    zIndex: 90
  }

  // Katana
  if (isKatanaVault) {
    const katanaBreakdownTitle = 'Katana Est. APY breakdown'
    const katanaBreakdownBaseApr = data.baseForwardApr
    const katanaDetails = (
      <KatanaApyTooltipContent
        katanaNativeYield={katanaBreakdownBaseApr}
        fixedRateKatanRewardsAPR={katanaExtras?.FixedRateKatanaRewards ?? 0}
        katanaAppRewardsAPR={katanaExtras?.katanaAppRewardsAPR ?? katanaExtras?.katanaRewardsAPR ?? 0}
        katanaBonusAPR={katanaExtras?.katanaBonusAPY ?? 0}
        steerPointsPerDollar={katanaExtras?.steerPointsPerDollar}
        isEligibleForSpectraBoost={isEligibleForSpectraBoost}
        currentVault={currentVault}
        maxWidth={'w-full'}
        nativeYieldLabel={'Est. Native APY'}
      />
    )
    const modalContent = katanaDetails

    const tooltipMode = allowTooltip ? resolveTooltipMode(canOpenModal, Boolean(tooltipContent)) : 'none'
    const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
    const katanaEstApr = data.katanaEstApr ?? 0
    const displayConfig: TApyDisplayConfig = {
      fixedRateIndicator,
      value: <RenderAmount value={katanaEstApr} symbol={'percent'} decimals={6} />,
      shouldRender: true,
      fallbackLabel: 'NEW',
      tooltip: tooltipConfig,
      isInteractive: tooltipMode === 'tooltip+modal' && canOpenModal,
      showUnderline: tooltipMode !== 'none',
      showAsterisk: tooltipMode === 'tooltip+modal',
      subline: katanaSubline
    }

    const modalConfig: TApyModalConfig | undefined =
      tooltipMode === 'tooltip+modal'
        ? {
            title: katanaBreakdownTitle,
            content: modalContent,
            canOpen: true
          }
        : undefined

    return { displayConfig, modalConfig }
  }

  // No forward APY (or Katana with no extras)
  if (data.mode === 'noForward' || currentVault.chainID === KATANA_CHAIN_ID) {
    const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
    const boostedAPY = data.rewardsAprSum + data.netApr
    const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0

    if (data.rewardsAprSum > 0) {
      const modalContent = (
        <APYTooltipContent
          baseAPY={data.netApr}
          rewardsAPY={data.rewardsAprSum}
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelp={data.hasKelp}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        />
      )

      const tooltipMode = allowTooltip ? resolveTooltipMode(canOpenModal, Boolean(tooltipContent)) : 'none'
      const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
      const displayConfig: TApyDisplayConfig = {
        fixedRateIndicator,
        value: (
          <>
            {'⚡️ '}
            <RenderAmount shouldHideTooltip={hasZeroBoostedAPY} value={boostedAPY} symbol={'percent'} decimals={6} />
          </>
        ),
        shouldRender: shouldRenderForward,
        fallbackLabel: 'NEW',
        tooltip: tooltipConfig,
        isInteractive: tooltipMode === 'tooltip+modal' && canOpenModal,
        showUnderline: tooltipMode !== 'none',
        showAsterisk: false,
        subline: standardSubline
      }

      const modalConfig: TApyModalConfig | undefined =
        tooltipMode === 'tooltip+modal'
          ? {
              title: 'APY breakdown',
              content: modalContent,
              canOpen: true
            }
          : undefined

      return { displayConfig, modalConfig }
    }

    const tooltipMode = allowTooltip ? resolveTooltipMode(false, Boolean(tooltipContent)) : 'none'
    const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
    const displayConfig: TApyDisplayConfig = {
      fixedRateIndicator,
      value: <RenderAmount value={data.netApr} shouldHideTooltip={hasZeroAPY} symbol={'percent'} decimals={6} />,
      shouldRender: shouldRenderForward,
      fallbackLabel: 'NEW',
      tooltip: tooltipConfig,
      isInteractive: false,
      showUnderline: tooltipMode !== 'none',
      showAsterisk: false,
      subline: standardSubline
    }

    return { displayConfig }
  }

  // Boosted
  if (data.mode === 'boosted' && data.isBoosted) {
    const tooltipMode = allowTooltip ? resolveTooltipMode(false, Boolean(tooltipContent)) : 'none'
    const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
    const displayConfig: TApyDisplayConfig = {
      fixedRateIndicator,
      value: (
        <RenderAmount shouldHideTooltip value={currentVault.apr.forwardAPR.netAPR} symbol={'percent'} decimals={6} />
      ),
      shouldRender: shouldRenderForward,
      fallbackLabel: 'NEW',
      tooltip: tooltipConfig,
      isInteractive: false,
      showUnderline: tooltipMode !== 'none',
      showAsterisk: false,
      subline: standardSubline
    }

    return { displayConfig }
  }

  // Rewards (VeYFI or generic)
  if (data.mode === 'rewards') {
    const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
    const veYFIRange: [number, number] | undefined = isSourceVeYFI ? data.veYfiRange : undefined
    const estAPYRange: [number, number] | undefined = isSourceVeYFI ? data.estAprRange : undefined
    const boostedAPY = isSourceVeYFI
      ? (veYFIRange?.[0] || 0) + data.baseForwardApr
      : data.rewardsAprSum + data.baseForwardApr
    const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0

    const modalContent = (
      <APYTooltipContent
        baseAPY={data.baseForwardApr}
        rewardsAPY={veYFIRange ? undefined : data.rewardsAprSum}
        hasPendleArbRewards={data.hasPendleArbRewards}
        hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        hasKelp={data.hasKelp}
        range={veYFIRange}
      />
    )

    const tooltipMode = allowTooltip ? resolveTooltipMode(canOpenModal, Boolean(tooltipContent)) : 'none'
    const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
    const displayConfig: TApyDisplayConfig = {
      fixedRateIndicator,
      value: (
        <>
          {'⚡️ '}
          {estAPYRange ? (
            <Fragment>
              <RenderAmount shouldHideTooltip value={estAPYRange[0]} symbol={'percent'} decimals={6} />
              &nbsp;&rarr;&nbsp;
              <RenderAmount shouldHideTooltip value={estAPYRange[1]} symbol={'percent'} decimals={6} />
            </Fragment>
          ) : (
            <RenderAmount shouldHideTooltip={hasZeroBoostedAPY} value={boostedAPY} symbol={'percent'} decimals={6} />
          )}
        </>
      ),
      shouldRender: shouldRenderForward,
      fallbackLabel: 'NEW',
      tooltip: tooltipConfig,
      isInteractive: tooltipMode === 'tooltip+modal' && canOpenModal,
      showUnderline: tooltipMode !== 'none',
      showAsterisk: false,
      subline: standardSubline,
      valueClassName: 'whitespace-nowrap'
    }

    const modalConfig: TApyModalConfig | undefined =
      tooltipMode === 'tooltip+modal'
        ? {
            title: 'APY breakdown',
            content: modalContent,
            canOpen: true
          }
        : undefined

    return { displayConfig, modalConfig }
  }

  // Spot forward APY
  if (data.mode === 'spot') {
    const tooltipMode = allowTooltip ? resolveTooltipMode(false, Boolean(tooltipContent)) : 'none'
    const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
    const displayConfig: TApyDisplayConfig = {
      fixedRateIndicator,
      value: (
        <>
          {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
          <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
        </>
      ),
      shouldRender: shouldRenderForward,
      fallbackLabel: 'NEW',
      tooltip: tooltipConfig,
      isInteractive: false,
      showUnderline: tooltipMode !== 'none',
      showAsterisk: false,
      subline: standardSubline
    }

    return { displayConfig }
  }

  // Fallback historical APY - This will always be reached for any unhandled case
  const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
  const tooltipMode = allowTooltip ? resolveTooltipMode(false, Boolean(tooltipContent)) : 'none'
  const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)
  const displayConfig: TApyDisplayConfig = {
    fixedRateIndicator,
    value: (
      <>
        {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
        <RenderAmount shouldHideTooltip={hasZeroAPY} value={data.netApr} symbol={'percent'} decimals={6} />
      </>
    ),
    shouldRender: shouldRenderForward && shouldRenderHistorical,
    fallbackLabel: 'NEW',
    tooltip: tooltipConfig,
    isInteractive: false,
    showUnderline: tooltipMode !== 'none',
    showAsterisk: false,
    subline: standardSubline
  }

  return { displayConfig }
}

type THistoricalApyDisplayParams = {
  currentVault: TYDaemonVault
  data: TVaultApyData
  showSublineTooltip: boolean
  showBoostDetails?: boolean
  onRequestModalOpen?: () => void
}

export function resolveHistoricalApyDisplayConfig({
  currentVault,
  data,
  showSublineTooltip,
  showBoostDetails = true,
  onRequestModalOpen
}: THistoricalApyDisplayParams): {
  displayConfig: TApyDisplayConfig
  modalConfig?: TApyModalConfig
} {
  const fixedTermContext = buildFixedTermContext(currentVault)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())
  const baseSublineProps: TApySublineConfig = {
    hasPendleArbRewards: data.hasPendleArbRewards,
    hasKelpNEngenlayer: data.hasKelpNEngenlayer,
    hasKelp: data.hasKelp,
    isEligibleForSteer: data.isEligibleForSteer,
    steerPointsPerDollar: data.steerPointsPerDollar,
    isEligibleForSpectraBoost
  }
  const sublineLines = getApySublineLines(baseSublineProps)

  const fixedRateTooltipLines =
    fixedTermContext.fixedTermProviders.length > 0
      ? fixedTermContext.fixedTermProviders.map((market) => `Fixed-rate markets available on ${market.label}.`)
      : []

  const boostTooltipLine =
    showBoostDetails && data.mode === 'boosted' && data.isBoosted
      ? `Boost ${formatAmount(data.boost || 0, 2, 2)}x`
      : null
  const allowTooltipBase = showSublineTooltip || Boolean(boostTooltipLine)
  const extraTooltipLines = showSublineTooltip ? [...sublineLines, ...fixedRateTooltipLines] : []
  const standardTooltipLines = [boostTooltipLine, ...extraTooltipLines].filter((line): line is string => Boolean(line))
  const standardTooltipContent = buildStandardTooltipContent({
    lines: standardTooltipLines,
    fixedTermProviders: fixedTermContext.fixedTermProviders,
    showFixedRateLinks: showSublineTooltip && fixedTermContext.fixedTermProviders.length > 0
  })

  const shouldUseKatanaAPRs = currentVault.chainID === KATANA_CHAIN_ID
  const katanaThirtyDayApr = data.katanaThirtyDayApr
  const hasKatanaApr = typeof katanaThirtyDayApr === 'number'
  const monthlyAPY = currentVault.apr.points.monthAgo
  const weeklyAPY = currentVault.apr.points.weekAgo
  const standardThirtyDayApr = isZero(monthlyAPY) ? weeklyAPY : monthlyAPY
  const standardShouldRender = !currentVault.apr?.type.includes('new')
  let displayValue = standardThirtyDayApr
  if (shouldUseKatanaAPRs && hasKatanaApr) {
    displayValue = katanaThirtyDayApr ?? 0
  }
  const shouldRenderValue = shouldUseKatanaAPRs ? hasKatanaApr || standardShouldRender : standardShouldRender
  const fallbackLabel = shouldUseKatanaAPRs ? '-' : 'NEW'
  const hasZeroAPY = isZero(displayValue || 0) || Number((displayValue || 0).toFixed(2)) === 0
  const allowTooltip = allowTooltipBase && shouldRenderValue

  const katanaExtras = data.katanaExtras
  const hasKatanaRewards = Boolean(shouldUseKatanaAPRs && katanaExtras && hasKatanaApr)
  const allowModal = hasKatanaRewards && shouldRenderValue
  const katanaTooltipContent =
    showSublineTooltip && hasKatanaRewards
      ? buildKatanaTooltipContent({
          fixedTermProviders: fixedTermContext.fixedTermProviders,
          fixedTermIcons: fixedTermContext.fixedTermIcons,
          fixedTermProviderLabel: fixedTermContext.fixedTermProviderLabel,
          showModalCTA: allowModal,
          onRequestModalOpen
        })
      : null
  const tooltipContent = katanaTooltipContent ?? standardTooltipContent

  const fixedRateIndicator = fixedTermContext.fixedTermIndicator
  const baseTooltipConfig: TApyTooltipConfig = {
    mode: 'none',
    content: tooltipContent,
    className: DEFAULT_TOOLTIP_CLASS,
    openDelayMs: DEFAULT_TOOLTIP_DELAY,
    side: 'top'
  }
  let tooltipMode: TApyTooltipMode = 'none'
  if (allowTooltip) {
    if (hasKatanaRewards) {
      tooltipMode = resolveTooltipMode(allowModal, Boolean(tooltipContent))
    } else {
      tooltipMode = resolveTooltipMode(false, Boolean(tooltipContent))
    }
  }
  const canOpenModal = allowModal && tooltipMode === 'tooltip+modal'
  const tooltipConfig = withTooltipMode(baseTooltipConfig, tooltipMode)

  const displayConfig: TApyDisplayConfig = {
    value: <RenderAmount shouldHideTooltip={hasZeroAPY} value={displayValue || 0} symbol={'percent'} decimals={6} />,
    shouldRender: shouldRenderValue,
    fallbackLabel,
    tooltip: tooltipConfig,
    isInteractive: tooltipMode === 'tooltip+modal' && canOpenModal,
    showUnderline: tooltipMode !== 'none',
    showAsterisk: tooltipMode === 'tooltip+modal',
    fixedRateIndicator
  }

  if (!canOpenModal) {
    return { displayConfig }
  }

  const modalTitle = shouldUseKatanaAPRs ? 'Katana 30 Day APY breakdown' : '30 Day APY breakdown'
  const modalContent =
    shouldUseKatanaAPRs && katanaExtras ? (
      <KatanaApyTooltipContent
        katanaNativeYield={katanaExtras.katanaNativeYield ?? 0}
        fixedRateKatanRewardsAPR={katanaExtras.FixedRateKatanaRewards ?? 0}
        katanaAppRewardsAPR={katanaExtras.katanaAppRewardsAPR ?? katanaExtras.katanaRewardsAPR ?? 0}
        katanaBonusAPR={katanaExtras.katanaBonusAPY ?? 0}
        steerPointsPerDollar={katanaExtras.steerPointsPerDollar}
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

  return {
    displayConfig,
    modalConfig: {
      title: modalTitle,
      content: modalContent,
      canOpen: true
    }
  }
}
