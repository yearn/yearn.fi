import { describe, expect, it } from 'vitest'
import { formatWidgetPreciseValue, formatWidgetValue } from './valueDisplay'

describe('valueDisplay', () => {
  it('keeps compact formatting for the default widget display', () => {
    expect(formatWidgetValue(16_123456000n, 6)).toBe('16.1K')
  })

  it('formats precise widget values with standard notation and seven significant digits', () => {
    expect(formatWidgetPreciseValue(16_123456000n, 6)).toBe('16,123.46')
  })
})
