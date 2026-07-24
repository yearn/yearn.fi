import { describe, expect, it } from 'vitest'
import { formatWalletBalance, formatWidgetAllowance, formatWidgetValue } from './valueDisplay'

describe('widget value display', () => {
  it.each([
    [0, '0'],
    [3, '3.00'],
    [15.147248, '15.1'],
    [0.0043219, '0.00432'],
    [16_123.456, '16.1K'],
    [1_234_567_890_123, '1.23e12']
  ])('formats %s using the legacy three-significant-digit scheme', (value, expected) => {
    expect(formatWidgetValue(value)).toBe(expected)
  })

  it('uses subscript notation for very small values', () => {
    expect(formatWidgetValue(0.000000000004)).toBe('0.0₁₀4')
  })

  it('recognizes unlimited allowances', () => {
    expect(formatWidgetAllowance(2n ** 256n - 1n, 18)).toBe('Unlimited')
  })

  it.each([
    [15_147248000000000000n, 18, '15.15'],
    [4321900000000000n, 18, '0.0043219'],
    [4_000_000n, 18, '0.0₁₀4']
  ])('formats wallet balances with the legacy two-decimal scheme', (value, decimals, expected) => {
    expect(formatWalletBalance(value, decimals)).toBe(expected)
  })
})
