import type { TKongVaultStrategy } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { isActiveStrategy } from './strategyActivity'

const ACTIVE_STRATEGY: TKongVaultStrategy = {
  address: '0x0000000000000000000000000000000000000001',
  name: 'Active strategy',
  description: '',
  netAPR: 0.05,
  status: 'active',
  details: {
    totalDebt: '1000',
    totalLoss: '0',
    totalGain: '0',
    performanceFee: 0,
    lastReport: 0,
    debtRatio: 5000
  }
}

describe('isActiveStrategy', () => {
  it('requires active status and a positive allocation', () => {
    expect(isActiveStrategy(ACTIVE_STRATEGY)).toBe(true)
    expect(isActiveStrategy({ ...ACTIVE_STRATEGY, status: 'not_active' })).toBe(false)
    expect(isActiveStrategy({ ...ACTIVE_STRATEGY, status: 'unallocated' })).toBe(false)
    expect(
      isActiveStrategy({
        ...ACTIVE_STRATEGY,
        details: { ...ACTIVE_STRATEGY.details!, totalDebt: '0', debtRatio: 0 }
      })
    ).toBe(false)
  })
})
