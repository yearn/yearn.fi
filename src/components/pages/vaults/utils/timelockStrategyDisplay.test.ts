import { describe, expect, it } from 'vitest'
import { formatTimelockEta, formatTimelockMaxDebt, getTimelockBadgeLabel } from './timelockStrategyDisplay'

describe('timelock strategy display helpers', () => {
  it('formats raw max debt with token decimals and symbol', () => {
    expect(formatTimelockMaxDebt('100000000000000', 6, 'USDC')).toBe('100,000,000 USDC')
  })

  it('returns the ready badge label', () => {
    expect(getTimelockBadgeLabel('ready')).toBe('Timelock ready')
  })

  it('returns the queued badge label', () => {
    expect(getTimelockBadgeLabel('queued')).toBe('Pending timelock')
  })

  it('formats eta as a readable date', () => {
    expect(formatTimelockEta(1_780_509_347, 1_780_000_000_000)).toContain('2026')
  })
})
