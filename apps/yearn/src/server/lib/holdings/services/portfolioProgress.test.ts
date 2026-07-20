import { beforeEach, describe, expect, it, vi } from 'vitest'

const progressMocks = vi.hoisted(() => ({
  updateHoldingsProgress: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/progress', () => ({
  updateHoldingsProgress: progressMocks.updateHoldingsProgress
}))

import {
  createHoldingsPortfolioProgressTracker,
  resolveHoldingsPortfolioProgress
} from '@/server/lib/holdings/services/portfolioProgress'

describe('combined holdings portfolio progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressMocks.updateHoldingsProgress.mockResolvedValue(undefined)
  })

  it('starts by checking saved portfolio history', () => {
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 8 },
        growth: { progress: 8 }
      })
    ).toEqual({
      progress: 8,
      message: 'Checking saved portfolio history',
      detail: null
    })
  })

  it('keeps the slower Growth lane visible after Balance completes', () => {
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 100 },
        growth: { progress: 52 }
      })
    ).toEqual({
      progress: 71,
      message: 'Fetching historical prices',
      detail: null
    })
  })

  it('selects Balance when it has more weighted work remaining', () => {
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 20 },
        growth: { progress: 90 }
      })
    ).toEqual({
      progress: 62,
      message: 'Loading wallet activity',
      detail: null
    })
  })

  it('enters each confirmed stage at its minimum progress', () => {
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 8 },
        growth: { progress: 12 }
      })
    ).toMatchObject({ progress: 15, message: 'Loading wallet activity' })
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 28 },
        growth: { progress: 30 }
      })
    ).toMatchObject({ progress: 30, message: 'Preparing vault history' })
  })

  it('caps joined lane progress below completion', () => {
    expect(
      resolveHoldingsPortfolioProgress({
        balance: { progress: 100 },
        growth: { progress: 100 }
      })
    ).toEqual({
      progress: 98,
      message: 'Saving and finalizing portfolio history',
      detail: null
    })
  })

  it('publishes monotonic lane progress and ignores late reports', async () => {
    const tracker = createHoldingsPortfolioProgressTracker('portfolio:test')

    tracker.reportBalanceProgress(28, 'Checked cached historical totals')
    tracker.reportBalanceProgress(18, 'Loaded wallet events')
    tracker.reportGrowthProgress(52, 'Prepared historical price requests')
    tracker.markBalanceComplete()
    await tracker.finish()
    tracker.reportGrowthProgress(72, 'Fetched historical asset prices')

    expect(progressMocks.updateHoldingsProgress.mock.calls.map((call) => call[1].progress)).toEqual([16, 45, 71, 98])
    expect(progressMocks.updateHoldingsProgress).toHaveBeenLastCalledWith('portfolio:test', {
      progress: 98,
      message: 'Saving and finalizing portfolio history',
      detail: null
    })
  })

  it('serializes progress writes and freezes reports after aborting', async () => {
    const firstWrite: { resolve?: () => void } = {}
    progressMocks.updateHoldingsProgress
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            firstWrite.resolve = resolve
          })
      )
      .mockResolvedValue(undefined)
    const tracker = createHoldingsPortfolioProgressTracker('portfolio:test')

    tracker.reportBalanceProgress(28, 'Checked cached historical totals')
    tracker.reportGrowthProgress(52, 'Prepared historical price requests')

    await vi.waitFor(() => expect(progressMocks.updateHoldingsProgress).toHaveBeenCalledTimes(1))
    firstWrite.resolve?.()
    await tracker.abort()
    tracker.reportBalanceProgress(76, 'Fetched historical token prices')

    expect(progressMocks.updateHoldingsProgress).toHaveBeenCalledTimes(2)
  })
})
