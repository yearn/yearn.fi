import type { StrategyDebtRatio } from './schema'

const TOTAL_ALLOCATION_BPS = 10000
export const ALLOCATION_COMPLETENESS_TOLERANCE_BPS = 5

export type AllocationCoverageClassification = 'complete' | 'partial-optimizer-scope' | 'unknown'

export interface AllocationCoverage {
  currentIncludedBps: number
  targetIncludedBps: number
  currentResidualBps: number
  targetResidualBps: number
  currentComplete: boolean
  targetComplete: boolean
  classification: AllocationCoverageClassification
  unallocatedBps: number | null
  unallocatedSource: 'same-timestamp-onchain' | 'same-timestamp-indexed' | null
}

function validateIncludedBps(label: 'current' | 'target', includedBps: number): void {
  if (includedBps > TOTAL_ALLOCATION_BPS + ALLOCATION_COMPLETENESS_TOLERANCE_BPS) {
    throw new Error(
      `Invalid optimizer allocation coverage: ${label} ratios total ${includedBps} bps, exceeding ${TOTAL_ALLOCATION_BPS} bps`
    )
  }
}

export function calculateAllocationCoverage(
  strategyDebtRatios: readonly Pick<StrategyDebtRatio, 'currentRatio' | 'targetRatio'>[]
): AllocationCoverage {
  const currentIncludedBps = strategyDebtRatios.reduce((sum, strategy) => sum + strategy.currentRatio, 0)
  const targetIncludedBps = strategyDebtRatios.reduce((sum, strategy) => sum + strategy.targetRatio, 0)

  validateIncludedBps('current', currentIncludedBps)
  validateIncludedBps('target', targetIncludedBps)

  const currentComplete = Math.abs(TOTAL_ALLOCATION_BPS - currentIncludedBps) <= ALLOCATION_COMPLETENESS_TOLERANCE_BPS
  const targetComplete = Math.abs(TOTAL_ALLOCATION_BPS - targetIncludedBps) <= ALLOCATION_COMPLETENESS_TOLERANCE_BPS
  const hasIncludedAllocation = currentIncludedBps > 0 || targetIncludedBps > 0
  const classification: AllocationCoverageClassification =
    currentComplete && targetComplete ? 'complete' : hasIncludedAllocation ? 'partial-optimizer-scope' : 'unknown'

  return {
    currentIncludedBps,
    targetIncludedBps,
    currentResidualBps: Math.max(0, TOTAL_ALLOCATION_BPS - currentIncludedBps),
    targetResidualBps: Math.max(0, TOTAL_ALLOCATION_BPS - targetIncludedBps),
    currentComplete,
    targetComplete,
    classification,
    unallocatedBps: null,
    unallocatedSource: null
  }
}
