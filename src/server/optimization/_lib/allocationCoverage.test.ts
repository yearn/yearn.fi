import { describe, expect, it } from 'vitest'
import { calculateAllocationCoverage } from './allocationCoverage'

function ratio(currentRatio: number, targetRatio = currentRatio) {
  return { currentRatio, targetRatio }
}

describe('calculateAllocationCoverage', () => {
  it('classifies exact 10,000 bps records as complete', () => {
    expect(calculateAllocationCoverage([ratio(6000), ratio(4000)])).toEqual({
      currentIncludedBps: 10000,
      targetIncludedBps: 10000,
      currentResidualBps: 0,
      targetResidualBps: 0,
      currentComplete: true,
      targetComplete: true,
      classification: 'complete',
      unallocatedBps: null,
      unallocatedSource: null
    })
  })

  it.each([
    [9998, 10002, 2, 0],
    [10002, 9998, 0, 2]
  ])('accepts rounding-tolerant totals and clamps minor overflow residuals', (currentIncludedBps, targetIncludedBps, currentResidualBps, targetResidualBps) => {
    expect(calculateAllocationCoverage([ratio(currentIncludedBps, targetIncludedBps)])).toMatchObject({
      currentIncludedBps,
      targetIncludedBps,
      currentResidualBps,
      targetResidualBps,
      currentComplete: true,
      targetComplete: true,
      classification: 'complete'
    })
  })

  it('reports a yvWETH-style record as partial optimizer scope, not unallocated', () => {
    expect(calculateAllocationCoverage([ratio(2000), ratio(2157)])).toEqual({
      currentIncludedBps: 4157,
      targetIncludedBps: 4157,
      currentResidualBps: 5843,
      targetResidualBps: 5843,
      currentComplete: false,
      targetComplete: false,
      classification: 'partial-optimizer-scope',
      unallocatedBps: null,
      unallocatedSource: null
    })
  })

  it('keeps current and target coverage separate', () => {
    expect(calculateAllocationCoverage([ratio(6000, 5000), ratio(4000, 2500)])).toMatchObject({
      currentIncludedBps: 10000,
      targetIncludedBps: 7500,
      currentResidualBps: 0,
      targetResidualBps: 2500,
      currentComplete: true,
      targetComplete: false,
      classification: 'partial-optimizer-scope'
    })
  })

  it('classifies an empty optimizer scope as unknown', () => {
    expect(calculateAllocationCoverage([])).toMatchObject({
      currentIncludedBps: 0,
      targetIncludedBps: 0,
      currentResidualBps: 10000,
      targetResidualBps: 10000,
      currentComplete: false,
      targetComplete: false,
      classification: 'unknown',
      unallocatedBps: null,
      unallocatedSource: null
    })
  })

  it('rejects materially invalid totals', () => {
    expect(() => calculateAllocationCoverage([ratio(10006)])).toThrow(
      'current ratios total 10006 bps, exceeding 10000 bps'
    )
  })
})
