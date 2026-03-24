import { describe, expect, it } from 'vitest'
import { buildApyDataFromPpsSeries, buildUnderlyingLockedPpsSeries } from './useYvUsdCharts.helpers'

describe('buildUnderlyingLockedPpsSeries', () => {
  it('converts locked PPS into underlying terms using the unlocked PPS for the same date', () => {
    const result = buildUnderlyingLockedPpsSeries({
      unlockedSeries: [
        { date: 'd0', PPS: 1.002071 },
        { date: 'd1', PPS: 1.005734 }
      ],
      lockedSeries: [
        { date: 'd0', PPS: 1.014987 },
        { date: 'd1', PPS: 1.038008 }
      ]
    })

    expect(result).not.toBeNull()
    expect(result?.[0]?.PPS).toBeCloseTo(1.017089038077, 12)
    expect(result?.[1]?.PPS).toBeCloseTo(1.043959937872, 12)
  })

  it('returns null PPS points when the unlocked date match is missing', () => {
    const result = buildUnderlyingLockedPpsSeries({
      unlockedSeries: [{ date: 'd0', PPS: 1.002071 }],
      lockedSeries: [
        { date: 'd0', PPS: 1.014987 },
        { date: 'd1', PPS: 1.038008 }
      ]
    })

    expect(result?.[0]?.PPS).toBeCloseTo(1.017089038077, 12)
    expect(result?.[1]?.PPS).toBeNull()
  })
})

describe('buildApyDataFromPpsSeries', () => {
  it('derives 30d and 7d APY from the corrected locked PPS series', () => {
    const current = 1.038008 * 1.005734
    const weekAgo = 1.037836 * 1.00489
    const monthAgo = 1.014987 * 1.002071
    const series = Array.from({ length: 31 }, (_, index) => ({
      date: `d${index}`,
      PPS: index === 0 ? monthAgo : index === 23 ? weekAgo : current
    }))

    const result = buildApyDataFromPpsSeries(series)
    const lastPoint = result?.[30]

    expect(lastPoint?.thirtyDayApy).toBeCloseTo(37.89120128, 6)
    expect(lastPoint?.sevenDayApy).toBeCloseTo(5.38388189, 6)
  })

  it('falls back to 7d and then 1d data when longer lookbacks are unavailable', () => {
    const weeklySeries = Array.from({ length: 8 }, (_, index) => ({
      date: `w${index}`,
      PPS: index === 0 ? 1 : 1.001
    }))
    const weeklyResult = buildApyDataFromPpsSeries(weeklySeries)
    const weeklyLastPoint = weeklyResult?.[7]

    expect(weeklyLastPoint?.thirtyDayApy).toBeNull()
    expect(weeklyLastPoint?.sevenDayApy).not.toBeNull()

    const derivedResult = buildApyDataFromPpsSeries([
      { date: 'd0', PPS: 1 },
      { date: 'd1', PPS: 1.001 }
    ])

    expect(derivedResult?.[1]?.thirtyDayApy).toBeNull()
    expect(derivedResult?.[1]?.sevenDayApy).toBeNull()
    expect(derivedResult?.[1]?.derivedApy).not.toBeNull()
  })
})
