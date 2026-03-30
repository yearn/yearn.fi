import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleAdditionalYvUsdDepositRefetch, shouldRefetchUnlockedAfterYvUsdDeposit } from './YvUsdDeposit.helpers'

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
})
