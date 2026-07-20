import { describe, expect, it } from 'vitest'
import {
  formatDays,
  resolveCooldownWindowState,
  resolveDurationSeconds,
  resolveYvUsdCooldownSummary
} from './cooldownUtils'

describe('resolveDurationSeconds', () => {
  it('uses the contract-provided duration when available', () => {
    expect(resolveDurationSeconds(7n * 86_400n, 5)).toBe(604800)
  })

  it('falls back to the configured number of days when contract data is unavailable', () => {
    expect(resolveDurationSeconds(undefined, 5)).toBe(432000)
  })
})

describe('formatDays', () => {
  it('formats the 5-day withdrawal fallback label correctly', () => {
    expect(formatDays(resolveDurationSeconds(undefined, 5), 5)).toBe('5 days')
  })

  it('formats contract-provided withdrawal windows without forcing the fallback value', () => {
    expect(formatDays(resolveDurationSeconds(7n * 86_400n, 5), 5)).toBe('7 days')
  })
})

describe('resolveCooldownWindowState', () => {
  it('treats a positive withdraw limit as an open window even if local countdown math would lag', () => {
    expect(
      resolveCooldownWindowState({
        hasActiveCooldown: true,
        nowTimestamp: 100,
        cooldownEnd: 200,
        windowEnd: 300,
        availableWithdrawLimit: 1n
      })
    ).toEqual({
      isCooldownActive: false,
      isWithdrawalWindowOpen: true,
      isCooldownWindowExpired: false
    })
  })

  it('marks the cooldown expired only when the withdrawal window has passed and no withdraw limit exists', () => {
    expect(
      resolveCooldownWindowState({
        hasActiveCooldown: true,
        nowTimestamp: 301,
        cooldownEnd: 200,
        windowEnd: 300,
        availableWithdrawLimit: 0n
      })
    ).toEqual({
      isCooldownActive: false,
      isWithdrawalWindowOpen: false,
      isCooldownWindowExpired: true
    })
  })
})

describe('resolveYvUsdCooldownSummary', () => {
  it('returns a cooling down summary while cooldown is active', () => {
    expect(
      resolveYvUsdCooldownSummary({
        hasActiveCooldown: true,
        isCooldownActive: true,
        isWithdrawalWindowOpen: false,
        isCooldownWindowExpired: false
      })
    ).toEqual({
      label: 'Cooling down',
      detail: 'Locked yvUSD is still in cooldown.',
      tone: 'cooling'
    })
  })

  it('returns a ready summary once withdrawals are available', () => {
    expect(
      resolveYvUsdCooldownSummary({
        hasActiveCooldown: true,
        isCooldownActive: false,
        isWithdrawalWindowOpen: true,
        isCooldownWindowExpired: false
      })
    ).toEqual({
      label: 'Ready to withdraw',
      detail: 'Locked yvUSD cooldown completed.',
      tone: 'ready'
    })
  })

  it('returns an expired summary when the withdrawal window closes', () => {
    expect(
      resolveYvUsdCooldownSummary({
        hasActiveCooldown: true,
        isCooldownActive: false,
        isWithdrawalWindowOpen: false,
        isCooldownWindowExpired: true
      })
    ).toEqual({
      label: 'Cooldown expired',
      detail: 'Withdrawal window closed. Start a new cooldown to withdraw.',
      tone: 'expired'
    })
  })

  it('returns null when there is no active cooldown', () => {
    expect(
      resolveYvUsdCooldownSummary({
        hasActiveCooldown: false,
        isCooldownActive: false,
        isWithdrawalWindowOpen: false,
        isCooldownWindowExpired: false
      })
    ).toBeNull()
  })
})
