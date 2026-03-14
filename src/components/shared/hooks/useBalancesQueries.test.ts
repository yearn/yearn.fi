import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TUseBalancesTokens } from './useBalances.multichains'
import { partitionTokensByQueryStage } from './useBalancesQueries.helpers'

const CHAIN1_TOKEN_A = '0x1111111111111111111111111111111111111111'
const CHAIN1_TOKEN_B = '0x2222222222222222222222222222222222222222'
const CHAIN10_TOKEN = '0x3333333333333333333333333333333333333333'
const CHAIN250_TOKEN = '0x4444444444444444444444444444444444444444'

function tokenKey(token: TUseBalancesTokens): string {
  return `${token.chainID}:${getAddress(token.address)}`
}

describe('partitionTokensByQueryStage', () => {
  it('dedupes tokens and keeps the priority chain separate', () => {
    const tokens: TUseBalancesTokens[] = [
      { address: CHAIN10_TOKEN, chainID: 10 },
      { address: CHAIN1_TOKEN_A, chainID: 1 },
      { address: CHAIN1_TOKEN_A, chainID: 1, symbol: 'dup' },
      { address: CHAIN1_TOKEN_B, chainID: 1 },
      { address: CHAIN250_TOKEN, chainID: 250 }
    ]

    const { priorityTokensByChain, secondaryTokensByChain } = partitionTokensByQueryStage(tokens, 1)

    expect(priorityTokensByChain[1]?.map(tokenKey)).toEqual([
      `1:${getAddress(CHAIN1_TOKEN_A)}`,
      `1:${getAddress(CHAIN1_TOKEN_B)}`
    ])
    expect(secondaryTokensByChain[10]?.map(tokenKey)).toEqual([`10:${getAddress(CHAIN10_TOKEN)}`])
    expect(secondaryTokensByChain[250]?.map(tokenKey)).toEqual([`250:${getAddress(CHAIN250_TOKEN)}`])
  })

  it('keeps all chains in the secondary stage when the priority chain is absent', () => {
    const tokens: TUseBalancesTokens[] = [
      { address: CHAIN10_TOKEN, chainID: 10 },
      { address: CHAIN250_TOKEN, chainID: 250 }
    ]

    const { priorityTokensByChain, secondaryTokensByChain } = partitionTokensByQueryStage(tokens, 1)

    expect(priorityTokensByChain).toEqual({})
    expect(secondaryTokensByChain[10]?.map(tokenKey)).toEqual([`10:${getAddress(CHAIN10_TOKEN)}`])
    expect(secondaryTokensByChain[250]?.map(tokenKey)).toEqual([`250:${getAddress(CHAIN250_TOKEN)}`])
  })
})
