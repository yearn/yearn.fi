import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  scheduleAdditionalYvUsdDepositRefetch,
  shouldDeferYvUsdDepositSuccessUntilClose
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

  it('only defers success effects for locked deposits', () => {
    expect(shouldDeferYvUsdDepositSuccessUntilClose('locked')).toBe(true)
    expect(shouldDeferYvUsdDepositSuccessUntilClose('unlocked')).toBe(false)
    expect(shouldDeferYvUsdDepositSuccessUntilClose(null)).toBe(false)
  })
})
