// @vitest-environment jsdom

import { TranchedVaultChartsSection } from '@pages/vaults/components/tranched/TranchedVaultChartsSection'
import { getTranchedProductById, YVUSD_TRANCHE_DEPLOYMENT } from '@pages/vaults/constants/tranchedProducts'
import type { TChartDataPoint } from '@pages/vaults/types/charts'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  actualApy: null as number | null,
  referenceApy: 0.04 as number | null,
  error: null as Error | null
}))

vi.mock('@pages/vaults/hooks/useVaultChartTimeseries', () => ({
  useVaultChartTimeseries: ({ address }: { address?: string }) => {
    const isTranche =
      address === YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed || address === YVUSD_TRANCHE_DEPLOYMENT.tranches.levered
    const apy = isTranche ? mocks.actualApy : mocks.referenceApy
    return {
      data:
        address && apy !== null
          ? {
              apyMonthly: [
                { time: 1767225600, value: apy },
                { time: 1767312000, value: apy + 0.01 }
              ],
              apyWeekly: [],
              pps: [],
              tvl: []
            }
          : undefined,
      isLoading: false,
      error: mocks.error
    }
  }
}))

vi.mock('@pages/vaults/components/detail/charts/YvUsdDualLineChart', () => ({
  DualLineApyChart: ({ chartData, timeframe }: { chartData: TChartDataPoint[]; timeframe: string }) => (
    <output aria-label="Senior APY" data-timeframe={timeframe}>
      {JSON.stringify(chartData)}
    </output>
  ),
  DualLineChartLegend: ({
    series,
    chartData
  }: {
    series: Array<{ key: string; label: string }>
    chartData: TChartDataPoint[]
  }) => (
    <div>
      {series
        .filter(({ key }) => chartData.some((point) => Number.isFinite(point[key])))
        .map(({ key, label }) => (
          <span key={key}>{label}</span>
        ))}
    </div>
  )
}))

vi.mock('@pages/vaults/components/detail/charts/APYChart', () => ({
  APYChart: ({ seriesLabel }: { seriesLabel: string }) => <output aria-label={seriesLabel} />
}))

afterEach(() => {
  cleanup()
  mocks.actualApy = null
  mocks.referenceApy = 0.04
  mocks.error = null
})

it.each([
  ['yvusd-fixed', 5, 'USDC-1'],
  ['yveth-fixed', 3, 'WETH-1']
] as const)('combines the target and reference APY for %s', (id, target, vaultName) => {
  render(<TranchedVaultChartsSection product={getTranchedProductById(id)!} />)

  const chart = screen.getByLabelText('Senior APY')
  expect(JSON.parse(chart.textContent ?? '[]')).toEqual([
    { date: expect.any(String), historical: 4, target },
    { date: expect.any(String), historical: 5, target }
  ])
  expect(screen.getByText('Target APY')).toBeTruthy()
  expect(screen.getByText('Reference APY')).toBeTruthy()
  expect(screen.getByText(`Reference APY shows ${vaultName} history.`)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Target APY' })).toBeNull()

  fireEvent.change(screen.getByRole('combobox', { name: 'Chart timeframe' }), { target: { value: '30d' } })
  expect(chart.getAttribute('data-timeframe')).toBe('30d')
})

it('shows actual tranche history even without price-per-share or TVL data', () => {
  mocks.actualApy = 0.02
  render(<TranchedVaultChartsSection product={getTranchedProductById('yvusd-fixed')!} />)

  expect(JSON.parse(screen.getByLabelText('Senior APY').textContent ?? '[]')).toEqual([
    { date: expect.any(String), historical: 2, target: 5 },
    { date: expect.any(String), historical: 3, target: 5 }
  ])
  expect(screen.getByText('Actual APY')).toBeTruthy()
  expect(screen.queryByText('Reference APY')).toBeNull()
})

it('keeps the target chart visible if all historical data is unavailable', () => {
  mocks.referenceApy = null
  mocks.error = new Error('Chart service unavailable')
  render(<TranchedVaultChartsSection product={getTranchedProductById('yvusd-fixed')!} />)

  expect(JSON.parse(screen.getByLabelText('Senior APY').textContent ?? '[]')).toHaveLength(365)
  expect(screen.getByText('Target APY')).toBeTruthy()
  expect(screen.getByText('Actual APY history is unavailable.')).toBeTruthy()
})

it('keeps a single illustrative series for Junior and shows an empty state for missing metrics', () => {
  render(<TranchedVaultChartsSection product={getTranchedProductById('yvusd-levered')!} />)
  expect(screen.getByLabelText('Illustrative APY')).toBeTruthy()
  expect(screen.queryByText('Target APY')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'TVL' }))
  expect(screen.getByText('No chart history is available for this vault yet.')).toBeTruthy()
})
