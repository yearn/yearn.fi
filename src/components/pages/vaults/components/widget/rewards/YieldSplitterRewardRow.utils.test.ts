import { describe, expect, it } from 'vitest'
import { buildYieldSplitterClaimCopy } from './YieldSplitterRewardRow.utils'

describe('buildYieldSplitterClaimCopy', () => {
  it('describes a single-token claim precisely', () => {
    const copy = buildYieldSplitterClaimCopy([
      {
        tokenAddress: '0x1111111111111111111111111111111111111111',
        symbol: 'KAT',
        decimals: 18,
        amount: 15n * 10n ** 17n,
        price: 1,
        usdValue: 1.5
      }
    ])

    expect(copy.ctaLabel).toBe('Claim')
    expect(copy.confirmMessage).toBe('Claim 1.5000 KAT')
    expect(copy.successMessage).toBe('You claimed 1.5000 KAT')
  })

  it('describes multi-token claims as a shared claim-all action', () => {
    const copy = buildYieldSplitterClaimCopy([
      {
        tokenAddress: '0x1111111111111111111111111111111111111111',
        symbol: 'KAT',
        decimals: 18,
        amount: 15n * 10n ** 17n,
        price: 1,
        usdValue: 1.5
      },
      {
        tokenAddress: '0x2222222222222222222222222222222222222222',
        symbol: 'USDC',
        decimals: 6,
        amount: 2_500_000n,
        price: 1,
        usdValue: 2.5
      }
    ])

    expect(copy.ctaLabel).toBe('Claim all')
    expect(copy.confirmMessage).toBe('Claim all yield splitter rewards (1.5000 KAT, 2.5000 USDC)')
    expect(copy.successMessage).toBe('You claimed all available yield splitter rewards: KAT, USDC.')
  })
})
