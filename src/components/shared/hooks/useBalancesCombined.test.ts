import { describe, expect, it } from 'vitest'
import { shouldUseDiscoveryFallbackToken } from './balanceDiscoveryFallback'

describe('shouldUseDiscoveryFallbackToken', () => {
  it('uses discovery fallback for staking tokens', () => {
    expect(
      shouldUseDiscoveryFallbackToken({
        token: { address: '0x1111111111111111111111111111111111111111', chainID: 1, isStakingToken: true },
        hasPositiveBalanceCache: false
      })
    ).toBe(true)
  })

  it('skips discovery fallback for non-catalog vault shares without other signals', () => {
    expect(
      shouldUseDiscoveryFallbackToken({
        token: { address: '0x1111111111111111111111111111111111111111', chainID: 1, isCatalogVault: false },
        hasPositiveBalanceCache: false
      })
    ).toBe(false)
  })

  it('uses discovery fallback for previously positive cached balances', () => {
    expect(
      shouldUseDiscoveryFallbackToken({
        token: { address: '0x1111111111111111111111111111111111111111', chainID: 1, isCatalogVault: true },
        hasPositiveBalanceCache: true
      })
    ).toBe(true)
  })

  it('skips discovery fallback for ordinary omitted catalog vault shares', () => {
    expect(
      shouldUseDiscoveryFallbackToken({
        token: { address: '0x1111111111111111111111111111111111111111', chainID: 1, isCatalogVault: true },
        hasPositiveBalanceCache: false
      })
    ).toBe(false)
  })
})
