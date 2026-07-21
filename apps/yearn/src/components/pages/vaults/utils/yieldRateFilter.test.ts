import { describe, expect, it } from 'vitest'

import { shouldIncludeFixedYieldVaults } from './yieldRateFilter'

describe('shouldIncludeFixedYieldVaults', () => {
  it('includes fixed products in All Vaults by default', () => {
    expect(shouldIncludeFixedYieldVaults('all', 'all')).toBe(true)
  })

  it('excludes fixed products from the floating-rate All Vaults view', () => {
    expect(shouldIncludeFixedYieldVaults('all', 'floating')).toBe(false)
  })

  it('always includes fixed products in Fixed Yield', () => {
    expect(shouldIncludeFixedYieldVaults('fixed', 'floating')).toBe(true)
  })
})
