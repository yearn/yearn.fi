import {
  resolveVaultWidgetUsdPrice,
  toVaultWidgetSafeTransactionDetails,
  toVaultWidgetToken,
  toVaultWidgetTokensByChain
} from '@shared/contexts/YearnVaultWidgetRuntimeProvider'
import type { TToken } from '@shared/types'
import { describe, expect, it } from 'vitest'

const TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const SAFE_TRANSACTION_HASH = `0x${'1'.repeat(64)}` as const
const EXECUTION_TRANSACTION_HASH = `0x${'2'.repeat(64)}` as const

function createToken(overrides: Partial<TToken> = {}): TToken {
  return {
    address: TOKEN_ADDRESS,
    balance: {
      decimals: 6,
      display: '2.5',
      normalized: 2.5,
      raw: 2_500_000n
    },
    chainID: 1,
    decimals: 6,
    logoURI: 'https://assets.example/token.png',
    name: 'Example token',
    symbol: 'TKN',
    value: 5,
    ...overrides
  }
}

describe('Yearn vault widget runtime adapter', () => {
  it('normalizes Yearn wallet tokens into the package runtime shape', () => {
    expect(toVaultWidgetToken(createToken())).toEqual({
      address: TOKEN_ADDRESS,
      balanceRaw: 2_500_000n,
      chainId: 1,
      decimals: 6,
      logoUri: 'https://assets.example/token.png',
      name: 'Example token',
      symbol: 'TKN',
      usdValue: 5
    })
  })

  it('normalizes the nested chain token lookup', () => {
    const token = createToken()

    expect(toVaultWidgetTokensByChain({ 1: { [TOKEN_ADDRESS]: token } })).toEqual({
      1: { [TOKEN_ADDRESS]: toVaultWidgetToken(token) }
    })
  })

  it('normalizes Safe transaction statuses and execution hashes', () => {
    expect(
      toVaultWidgetSafeTransactionDetails({
        executionTxHash: EXECUTION_TRANSACTION_HASH,
        safeTxHash: SAFE_TRANSACTION_HASH,
        txStatus: 'AWAITING_EXECUTION'
      })
    ).toEqual({
      executionTxHash: EXECUTION_TRANSACTION_HASH,
      safeTxHash: SAFE_TRANSACTION_HASH,
      status: 'awaiting-execution'
    })
  })

  it('prefers the live Yearn price over wallet and catalog fallbacks', () => {
    expect(
      resolveVaultWidgetUsdPrice({
        catalogPrice: 1,
        walletToken: createToken(),
        yearnPrice: 3
      })
    ).toBe(3)
  })

  it('derives a unit price from the Enso wallet value before using catalog TVL price', () => {
    expect(
      resolveVaultWidgetUsdPrice({
        catalogPrice: 1,
        walletToken: createToken(),
        yearnPrice: 0
      })
    ).toBe(2)
  })

  it('falls back to the catalog asset price when no live or wallet price exists', () => {
    expect(
      resolveVaultWidgetUsdPrice({
        catalogPrice: 1.25,
        walletToken: createToken({ value: 0 }),
        yearnPrice: 0
      })
    ).toBe(1.25)
  })
})
