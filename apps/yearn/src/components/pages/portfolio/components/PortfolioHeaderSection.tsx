import type { TPortfolioModel } from '@pages/portfolio/hooks/usePortfolioModel'
import { METRIC_VALUE_CLASS, MetricHeader, type TMetricBlock } from '@shared/components/MetricsCard'
import { Tooltip } from '@shared/components/Tooltip'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { formatPercent } from '@shared/utils'
import type { ReactElement } from 'react'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const headingTooltipClassName =
  'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'
const metricTooltipContentClassName = 'flex max-w-[280px] flex-col gap-1 leading-relaxed'
const metricCardClassName = 'bg-surface px-5 py-3 md:px-5 md:py-2.5'

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  'blendedMetrics' | 'hasKatanaHoldings' | 'isHoldingsLoading' | 'isSearchingBalances'
> & {
  isProtocolReturnLoading: boolean
  annualizedProtocolReturnPct: number | null | undefined
  annualizedIsPartial: boolean
  totalPortfolioValue: number | null
  balanceNote?: ReactElement
}

export function PortfolioHeaderSection({
  blendedMetrics,
  hasKatanaHoldings,
  isHoldingsLoading,
  isSearchingBalances,
  isProtocolReturnLoading,
  annualizedProtocolReturnPct,
  annualizedIsPartial,
  totalPortfolioValue,
  balanceNote
}: TPortfolioHeaderProps): ReactElement {
  const annualizedProtocolReturnTooltip = (
    <div className={metricTooltipContentClassName}>
      <p>{'All-time annualized protocol return while funds were actually held in your wallet.'}</p>

      <p>{'Time-weighted by baseline vault exposure. Price moves are excluded.'}</p>
      {annualizedIsPartial ? (
        <p>{'Some vaults could not be valued. This return covers only the included vaults.'}</p>
      ) : null}
    </div>
  )

  const katanaTooltipContent = (
    <div className={headingTooltipClassName}>
      <p>{'*One or more vaults are receiving extra incentives.'}</p>
      <p>{'*There may be conditions to earn this rate.'}</p>
    </div>
  )

  const metricSpinner = (
    <span className="inline-flex h-6 w-20 items-center justify-center">
      <IconSpinner className="size-4 text-text-secondary" />
    </span>
  )

  function renderApyValue(value: string, shouldShowAsterisk: boolean): ReactElement {
    if (!shouldShowAsterisk) {
      return <span>{value}</span>
    }
    return (
      <span className="relative inline-flex items-center">
        {value}
        <Tooltip
          className="ml-1 cursor-default !h-auto !w-auto !gap-0 !justify-start"
          openDelayMs={150}
          side="top"
          tooltip={katanaTooltipContent}
        >
          <span className="text-md text-text-secondary transition-colors hover:text-accent-500">{'*'}</span>
        </Tooltip>
      </span>
    )
  }

  function renderApyMetric(apyValue: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (apyValue === null) return <span>{'—'}</span>
    return renderApyValue(formatPercent(apyValue, 2, 2), hasKatanaHoldings)
  }

  function renderCurrencyMetric(value: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (value === null) return <span>{'—'}</span>
    return <span>{currencyFormatter.format(value)}</span>
  }

  function renderSignedPercentMetric(value: number | null | undefined): ReactElement {
    if (isProtocolReturnLoading) return metricSpinner
    if (value === null || value === undefined) return <span>{'—'}</span>

    const absoluteValue = formatPercent(Math.abs(value), 2, 2, 10_000)
    const signedValue = value > 0 ? `+${absoluteValue}` : value < 0 ? `-${absoluteValue}` : absoluteValue

    return <span className={'text-text-primary'}>{signedValue}</span>
  }

  const metrics: TMetricBlock[] = [
    {
      key: 'total-balance',
      secondaryLabel: balanceNote,
      header: <MetricHeader label="Total Vault Balance" tooltip="Total USD value of all your vault deposits." />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isSearchingBalances ? metricSpinner : renderCurrencyMetric(totalPortfolioValue)}
        </span>
      )
    },
    {
      key: 'est-annual',
      header: (
        <MetricHeader
          label="Est. Annual Return"
          tooltip="Projects potential returns based on your blended current APY."
        />
      ),
      value: <span className={METRIC_VALUE_CLASS}>{renderCurrencyMetric(blendedMetrics.estimatedAnnualReturn)}</span>
    },
    {
      key: 'current-apy',
      header: <MetricHeader label="Current APY" tooltip="Weighted by your total deposits across all Yearn vaults." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedCurrentAPY)}</span>
    },
    {
      key: '30-day-apy',
      header: <MetricHeader label="30-day APY" tooltip="Blended 30-day performance using your current positions." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedHistoricalAPY)}</span>
    },
    {
      key: 'annualized-protocol-return',
      header: (
        <MetricHeader
          label="All-Time Annualized Return"
          mobileLabel="All-Time Ann."
          tooltip={annualizedProtocolReturnTooltip}
        />
      ),
      value: <span className={METRIC_VALUE_CLASS}>{renderSignedPercentMetric(annualizedProtocolReturnPct)}</span>
    }
  ]
  const mobileMetrics = [metrics[0], metrics[2], metrics[1], metrics[4]]

  return (
    <section className="h-full bg-surface">
      <div className="grid grid-cols-2 gap-px bg-border md:hidden">
        {mobileMetrics.map((item) => (
          <div key={item.key} className={metricCardClassName}>
            <div className="flex items-center justify-between">{item.header}</div>
            <div className="pt-0.5">{item.value}</div>
            {item.secondaryLabel ? <div>{item.secondaryLabel}</div> : null}
            {item.footnote ? <div className="pt-1.5">{item.footnote}</div> : null}
          </div>
        ))}
      </div>
      <div className="hidden h-full grid-rows-5 gap-px bg-border md:grid">
        {metrics.map((item) => (
          <div key={item.key} className={metricCardClassName}>
            <div className="flex items-center justify-between">{item.header}</div>
            <div className="pt-0.5">{item.value}</div>
            {item.secondaryLabel ? <div>{item.secondaryLabel}</div> : null}
            {item.footnote ? <div className="pt-1.5">{item.footnote}</div> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
