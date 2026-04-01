import { getYvUsdTvlBreakdown } from '@pages/vaults/hooks/useYvUsdVaults.helpers'
import { describe, expect, it } from 'vitest'

describe('getYvUsdTvlBreakdown', () => {
  it('treats the unlocked vault TVL as total and derives the unlocked remainder after locked TVL', () => {
    expect(getYvUsdTvlBreakdown({ totalTvl: 1000, lockedTvl: 500 })).toEqual({
      totalTvl: 1000,
      unlockedTvl: 500,
      lockedTvl: 500
    })
  })

  it('clamps the unlocked remainder at zero when locked TVL exceeds total TVL', () => {
    expect(getYvUsdTvlBreakdown({ totalTvl: 100, lockedTvl: 120 })).toEqual({
      totalTvl: 100,
      unlockedTvl: 0,
      lockedTvl: 120
    })
  })
})
