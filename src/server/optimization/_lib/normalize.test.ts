import { describe, expect, it } from 'vitest'
import { normalizeChange } from './normalize'

describe('normalizeChange allocation coverage', () => {
  it('does not synthesize an Unallocated strategy from partial optimizer scope', () => {
    const normalized = normalizeChange({
      vault: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0',
      strategyDebtRatios: [
        {
          strategy: '0x1111111111111111111111111111111111111111',
          name: 'First strategy',
          currentRatio: 2000,
          targetRatio: 2000
        },
        {
          strategy: '0x2222222222222222222222222222222222222222',
          name: 'Second strategy',
          currentRatio: 2157,
          targetRatio: 2157
        }
      ],
      currentApr: 250,
      proposedApr: 275,
      explain: 'Optimizer recommendation'
    })

    expect(normalized.strategies).toHaveLength(2)
    expect(normalized.strategies.some((strategy) => strategy.isUnallocated)).toBe(false)
    expect(normalized.hasUnallocated).toBe(false)
    expect(normalized.unallocatedBps).toBeNull()
    expect(normalized.allocationCoverage).toMatchObject({
      currentIncludedBps: 4157,
      targetIncludedBps: 4157,
      currentResidualBps: 5843,
      targetResidualBps: 5843,
      classification: 'partial-optimizer-scope',
      unallocatedBps: null
    })
    expect(normalized.explain).toBe('Optimizer recommendation')
    expect(normalized.vaultAprCurrentPct).toBe(2.5)
    expect(normalized.vaultAprProposedPct).toBe(2.75)
  })
})
