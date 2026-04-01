import { formatStrategiesApy, formatStrategiesPercent } from '@pages/vaults/components/detail/strategiesPercentFormat'
import { describe, expect, it } from 'vitest'

describe('strategiesPercentFormat', () => {
  it('pads percentages to the strategy card precision rules', () => {
    expect(formatStrategiesPercent(12.34)).toBe('12.3%')
    expect(formatStrategiesPercent(13)).toBe('13.0%')
    expect(formatStrategiesPercent(5.2)).toBe('5.20%')
    expect(formatStrategiesPercent(0)).toBe('0.00%')
  })

  it('limits sub-1 percentages and apy to two decimal places', () => {
    expect(formatStrategiesPercent(0.9876)).toBe('0.99%')
    expect(formatStrategiesApy(0.00262)).toBe('0.26%')
  })

  it('applies upper-limit formatting for percentages at or above threshold', () => {
    expect(formatStrategiesPercent(501)).toBe('≥ 500%')
  })

  it('formats infinity values for percentage and APY', () => {
    expect(formatStrategiesPercent(Infinity)).toBe('∞%')
    expect(formatStrategiesApy(Infinity)).toBe('∞%')
  })
})
