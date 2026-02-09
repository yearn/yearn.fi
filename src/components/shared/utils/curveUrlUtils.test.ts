import { describe, expect, it } from 'vitest'
import { isCurveHostUrl, normalizeCurveUrl } from './curveUrlUtils'

describe('normalizeCurveUrl', () => {
  it('canonicalizes curve.fi to www.curve.finance', () => {
    expect(normalizeCurveUrl('https://curve.fi/pools')).toBe('https://www.curve.finance/pools')
  })

  it('canonicalizes curve.finance to www.curve.finance', () => {
    expect(normalizeCurveUrl('https://curve.finance/pools')).toBe('https://www.curve.finance/pools')
  })

  it('keeps canonical host unchanged', () => {
    expect(normalizeCurveUrl('https://www.curve.finance/pools')).toBe('https://www.curve.finance/pools')
  })

  it('returns empty string for invalid urls', () => {
    expect(normalizeCurveUrl('not-a-url')).toBe('')
  })
})

describe('isCurveHostUrl', () => {
  it('accepts allowed curve hosts', () => {
    expect(isCurveHostUrl('https://curve.fi/pools')).toBe(true)
    expect(isCurveHostUrl('https://www.curve.fi/pools')).toBe(true)
    expect(isCurveHostUrl('https://curve.finance/pools')).toBe(true)
    expect(isCurveHostUrl('https://www.curve.finance/pools')).toBe(true)
  })

  it('rejects non-curve hosts and invalid urls', () => {
    expect(isCurveHostUrl('https://example.com/pools')).toBe(false)
    expect(isCurveHostUrl('not-a-url')).toBe(false)
  })
})
