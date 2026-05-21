import { describe, expect, it } from 'vitest'
import { calculateMigrateMinSharesOut } from './useMigrateFlow'

describe('calculateMigrateMinSharesOut', () => {
  it('applies slippage to a positive destination share preview', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 100_000n,
        slippageBps: 50
      })
    ).toBe(99_500n)
  })

  it('uses integer-safe floor rounding after applying slippage', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 101n,
        slippageBps: 100
      })
    ).toBe(99n)
  })

  it('returns zero for missing or zero previews so submission can be guarded', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 0n,
        slippageBps: 50
      })
    ).toBe(0n)
  })
})
