import { PortfolioHistoryChart, PortfolioHistoryChartControls } from '@pages/portfolio/components/PortfolioHistoryChart'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => vi.fn() }))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ address: '0x123' }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({ allVaults: {} }) }))
vi.mock('@pages/portfolio/components/PortfolioGrowthContributionsChart', () => ({
  PortfolioGrowthContributionsChart: ({ totalPoints }: { totalPoints: Array<{ isEstimated?: boolean }> }) => (
    <div>{`Contribution chart:${totalPoints.some((point) => point.isEstimated) ? 'estimated' : 'exact'}`}</div>
  )
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
      growthWeightEth: 1,
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
  it.each(['usd', 'eth', 'index'] as const)(
    'uses the server coverage flag for %s even without named series',
    (mode) => {
      const label = mode === 'index' ? 'Index' : mode.toUpperCase()
      const summary = {
        ...props.protocolReturnSummary!,
        isComplete: true,
        growthIsPartial: { usd: false, eth: false, index: false, [mode]: true }
      }
      const html = renderToStaticMarkup(
        <PortfolioHistoryChart {...props} protocolReturnSummary={summary} growthDisplayModeOverride={mode} />
      )

      expect(html).toContain(`Some vaults could not be valued. ${label} data may be partial.`)
      expect(html).not.toContain('vault excluded')
      expect(html).toContain('Contribution chart')
    }
  )

  it.each(['usd', 'eth', 'index'] as const)(
    'explains fully unavailable %s valuation without switching charts',
    (mode) => {
      const label = mode === 'index' ? 'Index' : mode.toUpperCase()
      const html = renderToStaticMarkup(
        <PortfolioHistoryChart
          {...props}
          growthDisplayModeOverride={mode}
          protocolReturnSummary={{
            ...props.protocolReturnSummary!,
            growthIsPartial: { usd: true, eth: true, index: true }
          }}
          protocolReturnData={[
            {
              ...props.protocolReturnData![0]!,
              growthWeightUsd: null,
              growthWeightEth: null,
              growthIndex: null
            }
          ]}
        />
      )

      expect(html).toContain(`${label} growth unavailable: vault valuation data is incomplete.`)
      expect(html).not.toContain('Contribution chart')
    }
  )

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

  it.each(['usd', 'eth', 'index'] as const)(
    'does not infer %s coverage from the row summary or missing points',
    (mode) => {
      const html = renderToStaticMarkup(
        <PortfolioHistoryChart
          {...props}
          growthDisplayModeOverride={mode}
          protocolReturnSummary={{
            ...props.protocolReturnSummary!,
            growthIsPartial: { usd: false, eth: false, index: false }
          }}
          protocolReturnData={[
            ...props.protocolReturnData!,
            {
              ...props.protocolReturnData![0]!,
              date: '2026-01-02',
              growthWeightUsd: null,
              growthWeightEth: null,
              growthIndex: null
            }
          ]}
        />
      )

      expect(html).not.toContain('data may be partial.')
      expect(html).toContain('Contribution chart')
    }
  )

  it('does not label receipt-weighted growth estimated because mark-to-market growth was estimated', () => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryChart
        {...props}
        growthDisplayModeOverride={'usd'}
        protocolReturnData={[{ ...props.protocolReturnData![0]!, growthUsdEstimated: true }]}
      />
    )

    expect(html).toContain('Contribution chart:exact')
  })

  it.each(['balance', 'annualized'] as const)('does not show growth coverage warnings on %s', (activeTab) => {
    const html = renderToStaticMarkup(
      <PortfolioHistoryChart
        {...props}
        activeTab={activeTab}
        growthDisplayModeOverride={'index'}
        protocolReturnSummary={{
          ...props.protocolReturnSummary!,
          growthIsPartial: { usd: true, eth: true, index: true }
        }}
      />
    )

    expect(html).not.toContain('data may be partial.')
    expect(html).not.toContain('growth unavailable')
  })
})
