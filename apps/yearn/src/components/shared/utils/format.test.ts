import { afterEach, describe, expect, it } from 'vitest'
import { formatTAmount } from './format'

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

function mockNavigatorLanguage(language: string): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language }
  })
}

afterEach(() => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
    return
  }

  Reflect.deleteProperty(globalThis, 'navigator')
})

describe('formatTAmount', () => {
  it('keeps compact USD output in en-US style even when the browser locale differs', () => {
    mockNavigatorLanguage('nl-NL')

    expect(
      formatTAmount({
        value: 1_350_000,
        decimals: 0,
        symbol: 'USD',
        options: {
          shouldCompactValue: true,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
    ).toBe('$1.35M')
  })

  it('keeps non-compact USD output in en-US style even when the browser locale differs', () => {
    mockNavigatorLanguage('nl-NL')

    expect(
      formatTAmount({
        value: 1234.5,
        decimals: 0,
        symbol: 'USD',
        options: {
          shouldCompactValue: false,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      })
    ).toBe('$1,234.50')
  })
})
