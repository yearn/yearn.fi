import { PortfolioHistoryChart, PortfolioHistoryChartControls } from '@pages/portfolio/components/PortfolioHistoryChart'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => vi.fn() }))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ address: '0x123' }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({ allVaults: {} }) }))
vi.mock('@pages/portfolio/components/PortfolioGrowthContributionsChart', () => ({
  PortfolioGrowthContributionsChart: () => <div>{'Contribution chart'}</div>
}))
vi.mock('@pages/portfolio/components/PortfolioGrowthIndexChart', () => ({
  PortfolioGrowthIndexChart: () => <div>{'Index chart'}</div>
}))
vi.mock('@pages/portfolio/components/PortfolioHistoryBreakdownModal', () => ({
  PortfolioHistoryBreakdownModal: () => null
}))

const props: ComponentProps<typeof PortfolioHistoryChart> = {
  balanceData: null,
  protocolReturnData: [
    {
      date: '2026-01-01',
      growthWeightUsd: 100,
      growthUsd: 100,
      growthUsdEstimated: false,
      growthWeightEth: null,
      protocolReturnPct: 1,
      annualizedProtocolReturnPct: 10,
      growthIndex: 101
    }
  ],
  protocolReturnSummary: {
    totalVaults: 2,
    completeVaults: 1,
    partialVaults: 1,
    recommendedGrowthDisplay: 'eth',
    recommendedGrowthDisplayReason: 'eth_dominant',
    openBaselineCompositionUsd: { stable: 0, ethFamily: 100, other: 0 },
    isComplete: false
  },
  protocolReturnFamilySeries: [],
  denomination: 'usd',
  timeframe: '1y',
  activeTab: 'growth',
  growthDisplayModeOverride: 'eth',
  onGrowthDisplayModeOverrideChange: vi.fn(),
  balanceIsLoading: false,
  protocolReturnIsLoading: false
}

describe('portfolio growth pricing availability', () => {
  it('keeps ETH selected and explains missing prices instead of silently rendering Index', () => {
    const html = renderToStaticMarkup(<PortfolioHistoryChart {...props} />)

    expect(html).toContain('ETH growth unavailable: historical prices are missing for one or more vaults.')
    expect(html).not.toContain('Index chart')
    expect(html).not.toContain('Contribution chart')
  })

  it('keeps ETH available in the growth selector', () => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryChartControls
        activeTab={'growth'}
        onActiveTabChange={vi.fn()}
        denomination={'usd'}
        onDenominationChange={vi.fn()}
        timeframe={'1y'}
        onTimeframeChange={vi.fn()}
        resolvedGrowthDisplayMode={'eth'}
        onGrowthDisplayModeOverrideChange={vi.fn()}
      />
    )

    expect(html).toContain('<option value="eth" selected="">ETH</option>')
  })

  it.each(['usd', 'index'] as const)('warns when the %s growth history is incomplete', (mode) => {
    const html = renderToStaticMarkup(<PortfolioHistoryChart {...props} growthDisplayModeOverride={mode} />)

    expect(html).toContain('History is incomplete: some historical prices or vault data are missing.')
    expect(html).toContain(mode === 'usd' ? 'Contribution chart' : 'Index chart')
  })

  it('does not show an incomplete-history warning for complete USD history', () => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryChart
        {...props}
        growthDisplayModeOverride={'usd'}
        protocolReturnSummary={{ ...props.protocolReturnSummary!, isComplete: true }}
      />
    )

    expect(html).not.toContain('History is incomplete')
    expect(html).toContain('Contribution chart')
  })

  it('warns about ETH gaps even when USD receipt pricing is complete', () => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryChart
        {...props}
        protocolReturnSummary={{ ...props.protocolReturnSummary!, isComplete: true }}
        protocolReturnData={[
          { ...props.protocolReturnData![0]!, growthWeightEth: 1 },
          { ...props.protocolReturnData![0]!, date: '2026-01-02' }
        ]}
      />
    )

    expect(html).toContain('Some ETH growth history is unavailable because historical prices are missing.')
    expect(html).toContain('Contribution chart')
  })
})
