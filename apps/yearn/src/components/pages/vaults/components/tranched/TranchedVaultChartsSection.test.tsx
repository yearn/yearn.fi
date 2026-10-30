// @vitest-environment jsdom

import { TranchedVaultChartsSection } from '@pages/vaults/components/tranched/TranchedVaultChartsSection'
import { getTranchedProductById } from '@pages/vaults/constants/tranchedProducts'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ error: null as Error | null, isLoading: false }))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({
    allVaults: {},
    vaults: {
      example: {
        chainID: 1,
        version: '3',
        address: '0x0000000000000000000000000000000000000001',
        name: 'USDC-1',
        symbol: 'USDC-1'
      }
    }
  })
}))
vi.mock('@pages/vaults/hooks/useVaultChartTimeseries', () => ({
  useVaultChartTimeseries: () => ({
    data: {
      apyWeekly: [
        { time: 1767225600, value: 0.04 },
        { time: 1767312000, value: 0.06 }
      ],
      apyMonthly: [
        { time: 1767225600, value: 0.03 },
        { time: 1767312000, value: 0.05 }
      ],
      pps: [
        { time: 1767225600, value: 1 },
        { time: 1767312000, value: 1.01 }
      ],
      tvl: [
        { time: 1767225600, value: 1000000 },
        { time: 1767312000, value: 1100000 }
      ]
    },
    isLoading: mocks.isLoading,
    error: mocks.error
  })
}))
vi.mock('@pages/vaults/components/detail/charts/APYChart', () => ({
  APYChart: ({
    chartData,
    timeframe,
    seriesLabel
  }: {
    chartData: unknown
    timeframe: string
    seriesLabel?: string
  }) => (
    <output aria-label={seriesLabel ?? 'Historical APY'} data-timeframe={timeframe}>
      {JSON.stringify(chartData)}
    </output>
  )
}))

afterEach(() => {
  cleanup()
  mocks.error = null
  mocks.isLoading = false
})

it('shows the Fixed target history at 5% for every date and keeps the timeframe selector', () => {
  const product = getTranchedProductById('yvusd-fixed')!
  render(<TranchedVaultChartsSection product={product} />)
  fireEvent.click(screen.getByRole('button', { name: 'Target APY' }))
  expect(screen.getByRole('button', { name: 'Target APY' }).getAttribute('aria-pressed')).toBe('true')
  const data = JSON.parse(screen.getByLabelText('Target APY').textContent ?? '[]')
  expect(data.length).toBeGreaterThan(90)
  expect(
    data.every(
      (point: { thirtyDayApy: number; sevenDayApy: null; derivedApy: null }) =>
        point.thirtyDayApy === 5 && point.sevenDayApy === null && point.derivedApy === null
    )
  ).toBe(true)
  fireEvent.change(screen.getByRole('combobox', { name: 'Chart timeframe' }), { target: { value: '30d' } })
  expect(screen.getByLabelText('Target APY').getAttribute('data-timeframe')).toBe('30d')
  fireEvent.click(screen.getByRole('button', { name: '30-Day APY' }))
  expect(screen.queryByLabelText('Target APY')).toBeNull()
  expect(screen.getByLabelText('Historical APY')).toBeTruthy()
})

it('keeps the Junior chart options separate from the Fixed target', () => {
  render(<TranchedVaultChartsSection product={getTranchedProductById('yvusd-levered')!} />)
  expect(screen.queryByRole('button', { name: 'Target APY' })).toBeNull()
  expect(screen.getByRole('button', { name: '30-Day APY' })).toBeTruthy()
})

it('shows the mock target even when underlying chart data is unavailable', () => {
  mocks.error = new Error('Chart service unavailable')
  mocks.isLoading = true
  render(<TranchedVaultChartsSection product={getTranchedProductById('yvusd-fixed')!} />)
  fireEvent.click(screen.getByRole('button', { name: 'Target APY' }))
  expect(screen.getByLabelText('Target APY')).toBeTruthy()
  expect(screen.queryByText('Unable to load chart data right now.')).toBeNull()
})
