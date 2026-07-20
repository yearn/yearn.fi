import { resolveStrategyDisplayFees } from '@pages/vaults/components/detail/strategyDisplayFees'
import { describe, expect, it } from 'vitest'

describe('resolveStrategyDisplayFees', () => {
  it('uses linked vault fees when a strategy address is another vault', () => {
    expect(
      resolveStrategyDisplayFees({
        linkedVaultFees: { management: 0, performance: 0.1 },
        parentVaultFees: { management: 0.02, performance: 0.2 },
        strategyPerformanceFee: 0,
        variant: 'v3'
      })
    ).toEqual({ management: 0, performance: 0.1 })
  })

  it('falls back to parent vault performance fees for v3 strategy rows when strategy fee is unset', () => {
    expect(
      resolveStrategyDisplayFees({
        parentVaultFees: { management: 0, performance: 0.1 },
        strategyPerformanceFee: 0,
        variant: 'v3'
      })
    ).toEqual({ management: 0, performance: 0.1 })
  })

  it('preserves explicit v2 strategy performance fees', () => {
    expect(
      resolveStrategyDisplayFees({
        parentVaultFees: { management: 0.02, performance: 0.1 },
        strategyPerformanceFee: 500,
        variant: 'v2'
      })
    ).toEqual({ management: 0.02, performance: 0.05 })
  })
})
