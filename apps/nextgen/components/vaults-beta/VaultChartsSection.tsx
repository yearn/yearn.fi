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

type ChartTab = 'historical-pps' | 'historical-apy' | 'historical-tvl'

const CHART_TABS: Array<{ id: ChartTab; label: string }> = [
  { id: 'historical-pps', label: 'Performance' },
  { id: 'historical-apy', label: 'APY' },
  { id: 'historical-tvl', label: 'TVL' }
]

export function VaultChartsSection({ chainId, vaultAddress }: VaultChartsSectionProps): ReactElement {
  const normalizedAddress = vaultAddress ? toAddress(vaultAddress) : undefined

  const chartsApiBase = import.meta.env.VITE_CHARTS_API_BASE || (import.meta.env.DEV ? 'https://yearn.fi' : '')

  const endpoint = useMemo(() => {
    if (!normalizedAddress || !Number.isInteger(chainId)) {
      return null
    }
    const search = new URLSearchParams({
      chainId: String(chainId),
      address: normalizedAddress
    }).toString()
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

  const [activeTab, setActiveTab] = useState<ChartTab>('historical-pps')
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAME_OPTIONS[3])

  return (
    <div className={'space-y-4 md:py-3'}>
      <div className={'flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between'}>
        <div className={'flex flex-wrap gap-2'}>
          {CHART_TABS.map((tab) => (
            <button
              key={tab.id}
              type={'button'}
              onClick={() => setActiveTab(tab.id)}
              className={cl(
                'rounded-full border px-5 py-2 text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-white text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.12)] border-white'
                  : 'bg-neutral-100 text-neutral-500 border-transparent hover:bg-neutral-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={'flex flex-wrap gap-2'}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type={'button'}
              className={cl(
                'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                option.value === timeframe.value
                  ? 'bg-white text-neutral-900 shadow-[0_6px_18px_rgba(15,23,42,0.12)] border-white'
                  : 'bg-neutral-100 text-neutral-500 border-transparent hover:bg-neutral-50'
              )}
              onClick={() => setTimeframe(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
        <FixedHeightChartContainer>
          <ChartErrorBoundary>
            {activeTab === 'historical-pps' && transformed.ppsData ? (
              <PPSChart chartData={transformed.ppsData} timeframe={timeframe.value} />
            ) : null}
            {activeTab === 'historical-apy' && transformed.aprApyData ? (
              <APYChart chartData={transformed.aprApyData} timeframe={timeframe.value} />
            ) : null}
            {activeTab === 'historical-tvl' && transformed.tvlData ? (
              <TVLChart chartData={transformed.tvlData} timeframe={timeframe.value} />
            ) : null}
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
