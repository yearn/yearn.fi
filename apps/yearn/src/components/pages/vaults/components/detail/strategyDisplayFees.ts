import type { TKongVaultApr } from '@pages/vaults/domain/kongVaultSelectors'

export type TStrategyDisplayFees = Pick<TKongVaultApr['fees'], 'management' | 'performance'>

const normalizeFee = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0
  }
  if (value > 1) {
    return value / 10000
  }
  return value
}

export function resolveStrategyDisplayFees({
  linkedVaultFees,
  parentVaultFees,
  strategyPerformanceFee,
  variant
}: {
  linkedVaultFees?: TStrategyDisplayFees
  parentVaultFees: TStrategyDisplayFees
  strategyPerformanceFee: number | null | undefined
  variant: 'v2' | 'v3'
}): TStrategyDisplayFees {
  if (linkedVaultFees) {
    return linkedVaultFees
  }

  const normalizedStrategyPerformanceFee = normalizeFee(strategyPerformanceFee)
  const shouldUseStrategyPerformanceFee = variant === 'v2' || normalizedStrategyPerformanceFee > 0

  return {
    management: parentVaultFees.management,
    performance: shouldUseStrategyPerformanceFee ? normalizedStrategyPerformanceFee : parentVaultFees.performance
  }
}
