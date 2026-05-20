import { getBalanceQueryRefetchConfig } from '@shared/hooks/balanceQueryConfig'
import { describe, expect, it } from 'vitest'

describe('getBalanceQueryRefetchConfig', () => {
  it('always refetches wallet balances when the window regains focus', () => {
    expect(getBalanceQueryRefetchConfig()).toMatchObject({
      refetchOnWindowFocus: 'always',
      refetchOnMount: false,
      refetchOnReconnect: false
    })
  })
})
