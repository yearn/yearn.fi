import { describe, expect, it } from 'vitest'
import { compareDepositedValues } from './useSortVaults'

describe('compareDepositedValues', () => {
  const values = [0, 5, 20, 0]

  it('keeps holdings above zero balances when sorting descending', () => {
    expect(values.toSorted((a, b) => compareDepositedValues({ a, b, sortDirection: 'desc' }))).toEqual([20, 5, 0, 0])
  })

  it('keeps holdings above zero balances when sorting ascending', () => {
    expect(values.toSorted((a, b) => compareDepositedValues({ a, b, sortDirection: 'asc' }))).toEqual([5, 20, 0, 0])
  })
})
