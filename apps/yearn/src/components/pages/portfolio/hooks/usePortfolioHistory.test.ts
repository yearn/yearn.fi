import { describe, expect, it } from 'vitest'
import type { TPortfolioHistoryChartData, TPortfolioLiveBalanceSnapshot } from '../types/api'
import { upsertLivePortfolioBalancePoint } from './usePortfolioHistory.helpers'

const liveSnapshot: TPortfolioLiveBalanceSnapshot = {
  date: '2026-05-14',
  totalUsd: 1234,
  totalEth: 0.4,
  vaults: [
    {
      key: '1/0x1111111111111111111111111111111111111111',
      chainId: 1,
      vaultAddress: '0x1111111111111111111111111111111111111111',
      usdValue: 1234
    }
  ]
}

describe('upsertLivePortfolioBalancePoint', () => {
  it('appends a live USD point when history ends before the live snapshot date', () => {
    const data: TPortfolioHistoryChartData = [{ date: '2026-05-13', value: 1000 }]

    expect(upsertLivePortfolioBalancePoint({ data, denomination: 'usd', liveSnapshot })).toEqual([
      { date: '2026-05-13', value: 1000 },
      { date: '2026-05-14', value: 1234, isLive: true }
    ])
  })

  it('replaces an existing same-date point with the live value', () => {
    const data: TPortfolioHistoryChartData = [
      { date: '2026-05-13', value: 1000 },
      { date: '2026-05-14', value: 1100 }
    ]

    expect(upsertLivePortfolioBalancePoint({ data, denomination: 'usd', liveSnapshot })).toEqual([
      { date: '2026-05-13', value: 1000 },
      { date: '2026-05-14', value: 1234, isLive: true }
    ])
  })

  it('uses the ETH live total for ETH-denominated history', () => {
    const data: TPortfolioHistoryChartData = [{ date: '2026-05-13', value: 0.35 }]

    expect(upsertLivePortfolioBalancePoint({ data, denomination: 'eth', liveSnapshot })).toEqual([
      { date: '2026-05-13', value: 0.35 },
      { date: '2026-05-14', value: 0.4, isLive: true }
    ])
  })

  it('keeps ETH history unchanged when the live ETH total is unavailable', () => {
    const data: TPortfolioHistoryChartData = [{ date: '2026-05-13', value: 0.35 }]
    const snapshot = { ...liveSnapshot, totalEth: null }

    expect(upsertLivePortfolioBalancePoint({ data, denomination: 'eth', liveSnapshot: snapshot })).toBe(data)
  })

  it('keeps history unchanged when the live snapshot is unavailable', () => {
    const data: TPortfolioHistoryChartData = [{ date: '2026-05-13', value: 1000 }]

    expect(upsertLivePortfolioBalancePoint({ data, denomination: 'usd', liveSnapshot: null })).toBe(data)
  })
})
