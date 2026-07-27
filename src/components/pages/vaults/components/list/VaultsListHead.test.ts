import { describe, expect, it } from 'vitest'
import { getNextSortDirection } from './VaultsListHead'

describe('getNextSortDirection', () => {
  it('cycles a three-state sort through descending, ascending, and off', () => {
    expect(
      getNextSortDirection({
        activeSortBy: 'tvl',
        activeSortDirection: 'desc',
        nextSortBy: 'deposited',
        allowUnsorted: true
      })
    ).toBe('desc')
    expect(
      getNextSortDirection({
        activeSortBy: 'deposited',
        activeSortDirection: 'desc',
        nextSortBy: 'deposited',
        allowUnsorted: true
      })
    ).toBe('asc')
    expect(
      getNextSortDirection({
        activeSortBy: 'deposited',
        activeSortDirection: 'asc',
        nextSortBy: 'deposited',
        allowUnsorted: true
      })
    ).toBe('')
  })

  it('keeps ordinary sort columns two-state', () => {
    expect(
      getNextSortDirection({
        activeSortBy: 'tvl',
        activeSortDirection: 'asc',
        nextSortBy: 'tvl'
      })
    ).toBe('desc')
  })
})
