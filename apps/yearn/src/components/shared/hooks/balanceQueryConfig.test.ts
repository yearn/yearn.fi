import { describe, expect, it } from 'vitest'
import { getBalanceQueryRefetchConfig } from './balanceQueryConfig'

describe('getBalanceQueryRefetchConfig', () => {
  it('always refetches wallet balances when the window regains focus', () => {
    expect(getBalanceQueryRefetchConfig()).toMatchObject({
      refetchOnWindowFocus: 'always',
      refetchOnMount: false,
      refetchOnReconnect: false
    })
  })
})
