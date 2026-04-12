import { describe, expect, it } from 'vitest'
import { matchesSelectedV3Kind } from './useV3VaultFilter.utils'

describe('matchesSelectedV3Kind', () => {
  it('keeps yield splitters visible in the implicit default V3 view', () => {
    expect(
      matchesSelectedV3Kind({
        kind: 'yieldSplitter',
        types: ['multi'],
        hasUserHoldings: false,
        includeYieldSplittersByDefault: true
      })
    ).toBe(true)

    expect(
      matchesSelectedV3Kind({
        kind: 'strategy',
        types: ['multi'],
        hasUserHoldings: false,
        includeYieldSplittersByDefault: true
      })
    ).toBe(false)
  })

  it('still hides yield splitters for an explicit multi-only filter', () => {
    expect(
      matchesSelectedV3Kind({
        kind: 'yieldSplitter',
        types: ['multi'],
        hasUserHoldings: false,
        includeYieldSplittersByDefault: false
      })
    ).toBe(false)
  })

  it('treats yield splitters as part of the single-asset bucket when that filter is active', () => {
    expect(
      matchesSelectedV3Kind({
        kind: 'yieldSplitter',
        types: ['single'],
        hasUserHoldings: false,
        includeYieldSplittersByDefault: false
      })
    ).toBe(true)
  })
})
