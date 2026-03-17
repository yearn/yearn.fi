import type { TToken } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { filterAndSortTokenSelectorTokens, getExplicitTokenAddresses } from './tokenSelectorList.utils'

const TOKEN_A = '0x0000000000000000000000000000000000000001' as const
const TOKEN_B = '0x0000000000000000000000000000000000000002' as const
const TOKEN_C = '0x0000000000000000000000000000000000000003' as const

function buildToken({
  address,
  name,
  symbol,
  value = 0,
  normalizedBalance = 0,
  rawBalance = 0n
}: {
  address: `0x${string}`
  name: string
  symbol: string
  value?: number
  normalizedBalance?: number
  rawBalance?: bigint
}): TToken {
  return {
    address,
    name,
    symbol,
    decimals: 18,
    chainID: 1,
    logoURI: undefined,
    value,
    balance: {
      raw: rawBalance,
      normalized: normalizedBalance,
      display: String(normalizedBalance),
      decimals: 18
    }
  }
}

describe('filterAndSortTokenSelectorTokens', () => {
  it('puts configured top tokens first before sorting the rest by derived USD value', () => {
    const tokens = [
      buildToken({
        address: TOKEN_A,
        name: 'High Raw Balance',
        symbol: 'RAW',
        normalizedBalance: 100,
        rawBalance: 100n
      }),
      buildToken({
        address: TOKEN_B,
        name: 'High USD Value',
        symbol: 'USD',
        value: 150,
        normalizedBalance: 5,
        rawBalance: 5n
      }),
      buildToken({
        address: TOKEN_C,
        name: 'No Price',
        symbol: 'NOP',
        normalizedBalance: 200,
        rawBalance: 200n
      })
    ]

    const filtered = filterAndSortTokenSelectorTokens({
      tokens,
      mode: 'deposit',
      topTokenAddresses: [TOKEN_A],
      yearnKnownTokenAddresses: new Set([TOKEN_A.toLowerCase(), TOKEN_B.toLowerCase(), TOKEN_C.toLowerCase()]),
      explicitTokenAddresses: new Set<string>(),
      getTokenUsdValue: (token) => {
        if (token.address === TOKEN_A) {
          return 20
        }
        if (token.address === TOKEN_B) {
          return 150
        }
        return 0
      }
    })

    expect(filtered.map((token) => token.address)).toEqual([TOKEN_A, TOKEN_B])
  })

  it('hides tokens below the minimum USD value threshold unless they are explicit', () => {
    const filtered = filterAndSortTokenSelectorTokens({
      tokens: [
        buildToken({
          address: TOKEN_A,
          name: 'Dust Token',
          symbol: 'DST',
          normalizedBalance: 10,
          rawBalance: 10n
        }),
        buildToken({
          address: TOKEN_B,
          name: 'Visible Token',
          symbol: 'VIS',
          normalizedBalance: 2,
          rawBalance: 2n
        })
      ],
      mode: 'deposit',
      yearnKnownTokenAddresses: new Set([TOKEN_A.toLowerCase(), TOKEN_B.toLowerCase()]),
      explicitTokenAddresses: new Set<string>(),
      getTokenUsdValue: (token) => {
        if (token.address === TOKEN_A) {
          return 0.009
        }
        return 0.02
      }
    })

    expect(filtered.map((token) => token.address)).toEqual([TOKEN_B])
  })

  it('keeps an explicit custom token visible even when it is below the minimum USD value', () => {
    const explicitTokenAddresses = getExplicitTokenAddresses({
      customAddress: TOKEN_A
    })

    const filtered = filterAndSortTokenSelectorTokens({
      tokens: [
        buildToken({
          address: TOKEN_A,
          name: 'Unknown Token',
          symbol: 'UNK',
          normalizedBalance: 10,
          rawBalance: 10n
        })
      ],
      mode: 'deposit',
      searchText: TOKEN_A,
      yearnKnownTokenAddresses: new Set<string>(),
      explicitTokenAddresses,
      getTokenUsdValue: () => 0.009
    })

    expect(filtered.map((token) => token.address)).toEqual([TOKEN_A])
  })
})
