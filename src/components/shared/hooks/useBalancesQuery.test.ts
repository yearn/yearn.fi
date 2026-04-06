import { afterEach, describe, expect, it, vi } from 'vitest'

describe('balanceQueryKeys', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('../utils/tools.address')
  })

  it('separates cache keys by execution chain id', async () => {
    vi.doMock('../utils/tools.address', () => ({
      toAddress: (value?: string) => value?.toLowerCase() ?? '0x0'
    }))

    const { balanceQueryKeys } = await import('./useBalancesQuery')

    expect(balanceQueryKeys.byTokens(1, 73571, '0x123', ['0xabc'])).not.toEqual(
      balanceQueryKeys.byTokens(1, 73572, '0x123', ['0xabc'])
    )
  })

  it('keeps canonical chain id in the key for display-level grouping', async () => {
    vi.doMock('../utils/tools.address', () => ({
      toAddress: (value?: string) => value?.toLowerCase() ?? '0x0'
    }))

    const { balanceQueryKeys } = await import('./useBalancesQuery')

    expect(balanceQueryKeys.byChain(1, 73571)).toEqual(['balances', 'chain', 1, 'execution', 73571])
  })
})
