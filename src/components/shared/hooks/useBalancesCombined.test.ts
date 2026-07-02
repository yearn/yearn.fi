import { describe, expect, it } from 'vitest'
import type { TChainTokens, TToken } from '../types/mixed'
import { shouldUseDiscoveryFallbackToken } from './balanceDiscoveryFallback'
import type { TUseBalancesTokens } from './useBalances.multichains'
import { getRequiredMulticallTokens, mergeBalanceSources } from './useBalancesCombined'

const TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111' as const
const STAKING_ADDRESS = '0x2222222222222222222222222222222222222222' as const
const USDC_VAULT_ADDRESS = '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204' as const
const USDC_STAKING_ADDRESS = '0x622fA41799406B120f9a40dA843D358b7b2CFEE3' as const

function token(overrides: Partial<TToken> = {}): TToken {
  return {
    address: TOKEN_ADDRESS,
    chainID: 1,
    symbol: 'TKN',
    name: 'Token',
    decimals: 18,
    value: 0,
    balance: {
      raw: 0n,
      normalized: 0,
      display: '0',
      decimals: 18
    },
    ...overrides
  }
}

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

describe('mergeBalanceSources', () => {
  it('keeps an earlier non-zero USD value when multicall refreshes the same token balance without a price', () => {
    const ensoBalances: TChainTokens = {
      1: {
        [TOKEN_ADDRESS]: token({
          value: 42,
          balance: {
            raw: 1n,
            normalized: 1,
            display: '1',
            decimals: 18
          }
        })
      }
    }
    const multicallBalances: TChainTokens = {
      1: {
        [TOKEN_ADDRESS]: token({
          value: 0,
          balance: {
            raw: 2n,
            normalized: 2,
            display: '2',
            decimals: 18
          }
        })
      }
    }

    const merged = mergeBalanceSources(ensoBalances, multicallBalances)

    expect(merged[1][TOKEN_ADDRESS].value).toBe(42)
    expect(merged[1][TOKEN_ADDRESS].balance.raw).toBe(2n)
  })

  it('drops the USD value when the later balance source says the token balance is zero', () => {
    const ensoBalances: TChainTokens = {
      1: {
        [TOKEN_ADDRESS]: token({
          value: 42,
          balance: {
            raw: 1n,
            normalized: 1,
            display: '1',
            decimals: 18
          }
        })
      }
    }
    const multicallBalances: TChainTokens = {
      1: {
        [TOKEN_ADDRESS]: token({
          value: 0,
          balance: {
            raw: 0n,
            normalized: 0,
            display: '0',
            decimals: 18
          }
        })
      }
    }

    const merged = mergeBalanceSources(ensoBalances, multicallBalances)

    expect(merged[1][TOKEN_ADDRESS].value).toBe(0)
    expect(merged[1][TOKEN_ADDRESS].balance.raw).toBe(0n)
  })
})

describe('getRequiredMulticallTokens', () => {
  const disabledGaugeStakingToken: TUseBalancesTokens = {
    address: USDC_STAKING_ADDRESS,
    chainID: 1,
    isStakingToken: true,
    isStakingOnlyPair: true,
    pairedVaultAddress: USDC_VAULT_ADDRESS
  }
  const ordinaryStakingToken: TUseBalancesTokens = {
    address: STAKING_ADDRESS,
    chainID: 1,
    isStakingToken: true,
    isStakingOnlyPair: true,
    pairedVaultAddress: TOKEN_ADDRESS
  }

  it('waits for Enso before multicalling disabled veYFI gauge tokens', () => {
    const requiredTokens = getRequiredMulticallTokens({
      multicallTokens: [disabledGaugeStakingToken, ordinaryStakingToken],
      ensoBalances: {},
      isEnsoPending: true,
      hasEnsoError: false
    })

    expect(requiredTokens).toEqual([ordinaryStakingToken])
  })

  it('skips disabled veYFI gauge multicall when Enso returned that balance', () => {
    const requiredTokens = getRequiredMulticallTokens({
      multicallTokens: [disabledGaugeStakingToken],
      ensoBalances: {
        1: {
          [USDC_STAKING_ADDRESS]: token({
            address: USDC_STAKING_ADDRESS,
            value: 42,
            balance: {
              raw: 1n,
              normalized: 1,
              display: '1',
              decimals: 18
            }
          })
        }
      },
      isEnsoPending: false,
      hasEnsoError: false
    })

    expect(requiredTokens).toEqual([])
  })

  it('falls back to multicall for disabled veYFI gauges when Enso omits them', () => {
    const requiredTokens = getRequiredMulticallTokens({
      multicallTokens: [disabledGaugeStakingToken],
      ensoBalances: {},
      isEnsoPending: false,
      hasEnsoError: false
    })

    expect(requiredTokens).toEqual([disabledGaugeStakingToken])
  })

  it('falls back to multicall for disabled veYFI gauges when Enso errors', () => {
    const requiredTokens = getRequiredMulticallTokens({
      multicallTokens: [disabledGaugeStakingToken],
      ensoBalances: {},
      isEnsoPending: false,
      hasEnsoError: true
    })

    expect(requiredTokens).toEqual([disabledGaugeStakingToken])
  })

  it('keeps ordinary staking-only tokens in the required multicall bucket', () => {
    const requiredTokens = getRequiredMulticallTokens({
      multicallTokens: [ordinaryStakingToken],
      ensoBalances: {},
      isEnsoPending: true,
      hasEnsoError: false
    })

    expect(requiredTokens).toEqual([ordinaryStakingToken])
  })
})
