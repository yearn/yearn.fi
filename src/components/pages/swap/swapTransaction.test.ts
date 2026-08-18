import { toNormalizedBN } from '@shared/utils'
import { describe, expect, it } from 'vitest'
import {
  getSwapSuccessMessage,
  getSwapWorstCaseImpact,
  hasExecutableSwapMinimum,
  resolveSwapTokenBalance
} from './swapTransaction'

const TOKEN = '0x0000000000000000000000000000000000000001' as const

describe('swap transaction helpers', () => {
  it('uses the RPC balance when the selected custom token is absent from wallet balances', () => {
    const rpcBalance = toNormalizedBN(12_500_000n, 6)

    expect(
      resolveSwapTokenBalance({
        address: TOKEN,
        rpcToken: { address: TOKEN, balance: rpcBalance, decimals: 6 },
        fallbackWalletToken: {
          address: TOKEN,
          balance: toNormalizedBN(0n, 6)
        },
        fallbackDecimals: 6
      })
    ).toEqual(rpcBalance)
  })

  it('keeps an exact wallet balance authoritative when present', () => {
    const walletBalance = toNormalizedBN(2_000_000n, 6)

    expect(
      resolveSwapTokenBalance({
        address: TOKEN,
        walletBalanceToken: { address: TOKEN, balance: walletBalance },
        rpcToken: { address: TOKEN, balance: toNormalizedBN(3_000_000n, 6), decimals: 6 },
        fallbackDecimals: 6
      })
    ).toEqual(walletBalance)
  })

  it('blocks positive quotes without an enforceable minimum output', () => {
    expect(hasExecutableSwapMinimum(100n, 0n)).toBe(false)
    expect(getSwapWorstCaseImpact({ inputUsd: 100, expectedOutUsd: 99, minExpectedOutUsd: 0 })).toBe(100)
  })

  it('retains ordinary worst-case impact calculations for valid quotes', () => {
    expect(hasExecutableSwapMinimum(100n, 98n)).toBe(true)
    expect(getSwapWorstCaseImpact({ inputUsd: 100, expectedOutUsd: 99, minExpectedOutUsd: 98 })).toBe(2)
  })

  it('labels same-chain output as expected instead of realized', () => {
    expect(
      getSwapSuccessMessage({
        formattedInput: '10',
        fromSymbol: 'USDC',
        formattedExpectedOutput: '0.004',
        toSymbol: 'ETH',
        isCrossChain: false
      })
    ).toBe('Swap confirmed for 10 USDC. Expected output: 0.004 ETH.')
  })
})
