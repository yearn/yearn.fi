import { YVUSD_LOCKED_COOLDOWN_DAYS, YVUSD_WITHDRAW_WINDOW_DAYS } from '@pages/vaults/utils/yvUsd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getYvUsdDepositTypeItems,
  scheduleAdditionalYvUsdDepositRefetch,
  shouldRefetchUnlockedAfterYvUsdDeposit
} from './YvUsdDeposit.helpers'

describe('YvUsdDeposit', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('defers the unlocked branch refetch after a locked deposit success', () => {
    vi.useFakeTimers()
    const unlockedRefetch = vi.fn()
    scheduleAdditionalYvUsdDepositRefetch('locked', unlockedRefetch)

    expect(unlockedRefetch).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(unlockedRefetch).toHaveBeenCalledTimes(1)
  })

  it('does not schedule an extra refetch after an unlocked deposit success', () => {
    vi.useFakeTimers()
    const unlockedRefetch = vi.fn()
    scheduleAdditionalYvUsdDepositRefetch('unlocked', unlockedRefetch)

    vi.runAllTimers()

    expect(unlockedRefetch).not.toHaveBeenCalled()
  })

  it('only schedules the extra unlocked refetch for locked deposits', () => {
    expect(shouldRefetchUnlockedAfterYvUsdDeposit('locked')).toBe(true)
    expect(shouldRefetchUnlockedAfterYvUsdDeposit('unlocked')).toBe(false)
    expect(shouldRefetchUnlockedAfterYvUsdDeposit(null)).toBe(false)
  })

  it('lists the locked deposit timing and yield tradeoffs', () => {
    expect(getYvUsdDepositTypeItems('locked')).toEqual([
      `${YVUSD_LOCKED_COOLDOWN_DAYS} day cooldown`,
      `${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window`,
      'Higher yield'
    ])
  })

  it('lists the unlocked deposit liquidity and yield tradeoffs', () => {
    expect(getYvUsdDepositTypeItems('unlocked')).toEqual(['No cooldown or withdrawal window', 'Lower yield'])
  })
})
