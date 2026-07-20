import { describe, expect, it, vi } from 'vitest'
import {
  getPortfolioHistoryLoadDurationBucket,
  getPortfolioHistoryLoadPointBucket
} from './usePortfolioHistoryLoadTracking'

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

describe('portfolio history load tracking buckets', () => {
  it('buckets load duration into low-cardinality ranges', () => {
    expect(getPortfolioHistoryLoadDurationBucket(1999)).toBe('<2s')
    expect(getPortfolioHistoryLoadDurationBucket(2000)).toBe('2-5s')
    expect(getPortfolioHistoryLoadDurationBucket(5000)).toBe('5-10s')
    expect(getPortfolioHistoryLoadDurationBucket(10000)).toBe('10-30s')
    expect(getPortfolioHistoryLoadDurationBucket(30000)).toBe('30-60s')
    expect(getPortfolioHistoryLoadDurationBucket(60000)).toBe('60s+')
  })

  it('buckets returned data points without exposing exact counts', () => {
    expect(getPortfolioHistoryLoadPointBucket(undefined)).toBe('unknown')
    expect(getPortfolioHistoryLoadPointBucket(0)).toBe('0')
    expect(getPortfolioHistoryLoadPointBucket(365)).toBe('1-365')
    expect(getPortfolioHistoryLoadPointBucket(366)).toBe('366-900')
    expect(getPortfolioHistoryLoadPointBucket(901)).toBe('900+')
  })
})
