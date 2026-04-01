import { formatDays, resolveDurationSeconds } from '@pages/vaults/components/widget/yvUSD/cooldownUtils'
import { describe, expect, it } from 'vitest'

describe('resolveDurationSeconds', () => {
  it('uses the contract-provided duration when available', () => {
    expect(resolveDurationSeconds(7n * 86_400n, 5)).toBe(604800)
  })

  it('falls back to the configured number of days when contract data is unavailable', () => {
    expect(resolveDurationSeconds(undefined, 5)).toBe(432000)
  })
})

describe('formatDays', () => {
  it('formats the 5-day withdrawal fallback label correctly', () => {
    expect(formatDays(resolveDurationSeconds(undefined, 5), 5)).toBe('5 days')
  })

  it('formats contract-provided withdrawal windows without forcing the fallback value', () => {
    expect(formatDays(resolveDurationSeconds(7n * 86_400n, 5), 5)).toBe('7 days')
  })
})
