import { useFetch } from '@lib/hooks/useFetch'
import { cl, toAddress } from '@lib/utils'
import { vaultChartTimeseriesSchema } from '@lib/utils/schemas/vaultChartsSchema'
import type { TChartTimeseriesResponse } from '@nextgen/types/charts'
import { transformVaultChartData } from '@nextgen/utils/charts'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { APYChart } from './charts/APYChart'
import { ChartErrorBoundary } from './charts/ChartErrorBoundary'
import ChartSkeleton from './charts/ChartSkeleton'
import ChartsLoader from './charts/ChartsLoader'
import { FixedHeightChartContainer } from './charts/FixedHeightChartContainer'
import { PPSChart } from './charts/PPSChart'
import { TVLChart } from './charts/TVLChart'

type VaultChartsSectionProps = {
  chainId: number
  vaultAddress: string
  vaultName: string
}

type TimeframeOption = {
  label: string
  value: string
}

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
]

type ChartTab = 'historical-apy' | 'historical-pps' | 'historical-tvl'

export function VaultChartsSection({ chainId, vaultAddress, vaultName }: VaultChartsSectionProps): ReactElement {
  const normalizedAddress = vaultAddress ? toAddress(vaultAddress) : undefined

  const chartsApiBase = import.meta.env.VITE_CHARTS_API_BASE || (import.meta.env.DEV ? 'https://yearn.fi' : '')

  const endpoint = useMemo(() => {
    if (!normalizedAddress || !Number.isInteger(chainId)) {
      return null
    }
    const search = new URLSearchParams({ chainId: String(chainId), address: normalizedAddress }).toString()
    if (!chartsApiBase) {
      return `/api/vault/charts?${search}`
    }
    const trimmedBase = chartsApiBase.replace(/\/$/, '')
    return `${trimmedBase}/api/vault/charts?${search}`
  }, [chainId, normalizedAddress])

  const { data, error, isLoading } = useFetch<TChartTimeseriesResponse>({
    endpoint,
    schema: vaultChartTimeseriesSchema,
    config: {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000
    }
  })

  const transformed = useMemo(() => transformVaultChartData(data), [data])

  const chartsLoading = isLoading || !transformed.aprApyData || !transformed.ppsData || !transformed.tvlData
  const hasError = Boolean(error)

  const [activeTab, setActiveTab] = useState<ChartTab>('historical-apy')
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAME_OPTIONS[3])

  const chartInfo: Record<ChartTab, { title: string; description: string }> = {
    'historical-apy': {
      title: 'Vault Performance',
      description: `1-Day, 7-Day, and 30-Day APYs for ${vaultName}`
    },
    'historical-pps': {
      title: 'Share Growth',
      description: 'Price Per Share trends over time'
    },
    'historical-tvl': {
      title: 'Total Value Locked',
      description: 'Deposits in this vault'
    }
  }

  return (
    <div className={'space-y-6 p-4 md:p-8 md:py-6'}>
      <div className={'flex flex-col gap-4 md:flex-row md:items-center md:justify-between'}>
        <div>
          <p className={'text-sm font-semibold text-neutral-900'}>{'Performance charts'}</p>
          <p className={'text-xs text-neutral-500'}>{'Live APR, PPS, and TVL pulled from Yearn Kong.'}</p>
        </div>
        <div className={'flex flex-wrap gap-2'}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type={'button'}
              className={cl(
                'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                option.value === timeframe.value
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
              )}
              onClick={() => setTimeframe(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={'flex flex-wrap gap-2'}>
        {(
          [
            { id: 'historical-apy', label: 'Historical Performance' },
            { id: 'historical-pps', label: 'Historical Share Growth' },
            { id: 'historical-tvl', label: 'Historical TVL' }
          ] as Array<{ id: ChartTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type={'button'}
            onClick={() => setActiveTab(tab.id)}
            className={cl(
              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
              activeTab === tab.id
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 text-neutral-500 hover:bg-neutral-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {hasError ? (
        <div className={'rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700'}>
          {'Unable to load chart data right now.'}
        </div>
      ) : chartsLoading ? (
        <div className={'relative'}>
          <ChartSkeleton />
          <ChartsLoader loadingState={isLoading ? 'Loading charts' : 'Preparing charts'} />
        </div>
      ) : (
        <div className={'space-y-4'}>
          <div>
            <p className={'text-sm font-semibold text-neutral-900'}>
              {chartInfo[activeTab].title} ({timeframe.label})
            </p>
            <p className={'text-xs text-neutral-500'}>{chartInfo[activeTab].description}</p>
          </div>

          {activeTab === 'historical-apy' && transformed.aprApyData && transformed.tvlData ? (
            <FixedHeightChartContainer>
              <ChartErrorBoundary>
                <APYChart chartData={transformed.aprApyData} timeframe={timeframe.value} />
              </ChartErrorBoundary>
              <div className={'pointer-events-none absolute inset-0 opacity-10'}>
                <ChartErrorBoundary>
                  <TVLChart chartData={transformed.tvlData} timeframe={timeframe.value} hideAxes hideTooltip />
                </ChartErrorBoundary>
              </div>
            </FixedHeightChartContainer>
          ) : null}

          {activeTab === 'historical-pps' && transformed.ppsData && transformed.aprApyData ? (
            <FixedHeightChartContainer>
              <ChartErrorBoundary>
                <PPSChart chartData={transformed.ppsData} timeframe={timeframe.value} />
              </ChartErrorBoundary>
              <div className={'pointer-events-none absolute inset-0 opacity-30'}>
                <ChartErrorBoundary>
                  <APYChart
                    chartData={transformed.aprApyData}
                    timeframe={timeframe.value}
                    hideAxes
                    hideTooltip
                    defaultVisibleSeries={{ sevenDayApy: false, thirtyDayApy: false, derivedApy: true }}
                  />
                </ChartErrorBoundary>
              </div>
            </FixedHeightChartContainer>
          ) : null}

          {activeTab === 'historical-tvl' && transformed.tvlData && transformed.aprApyData ? (
            <FixedHeightChartContainer>
              <ChartErrorBoundary>
                <TVLChart chartData={transformed.tvlData} timeframe={timeframe.value} />
              </ChartErrorBoundary>
              <div className={'pointer-events-none absolute inset-0 opacity-30'}>
                <ChartErrorBoundary>
                  <APYChart
                    chartData={transformed.aprApyData}
                    timeframe={timeframe.value}
                    hideAxes
                    hideTooltip
                    defaultVisibleSeries={{ sevenDayApy: false, thirtyDayApy: true, derivedApy: false }}
                  />
                </ChartErrorBoundary>
              </div>
            </FixedHeightChartContainer>
          ) : null}
        </div>
      )}
    </div>
  )
}
