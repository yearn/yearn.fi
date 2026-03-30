import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TChainTokens } from '../types/mixed'
import type { TUseBalancesTokens } from './useBalances.multichains'
import { mergeStagedQueryData, partitionTokensByQueryStage } from './useBalancesQueries.helpers'

const CHAIN1_TOKEN_A = '0x1111111111111111111111111111111111111111'
const CHAIN1_TOKEN_B = '0x2222222222222222222222222222222222222222'
const CHAIN10_TOKEN = '0x3333333333333333333333333333333333333333'
const CHAIN250_TOKEN = '0x4444444444444444444444444444444444444444'

function normalizedBalance(raw: bigint, normalized: number, decimals: number = 18) {
  return {
    raw,
    normalized,
    display: normalized.toString(),
    decimals
  }
}

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

describe('mergeStagedQueryData', () => {
  it('reuses the previous object when staged query data is deep-equal', () => {
    const previousData: TChainTokens = {
      1: {
        [getAddress(CHAIN1_TOKEN_A)]: {
          address: getAddress(CHAIN1_TOKEN_A),
          chainID: 1,
          symbol: 'AAA',
          name: 'Token AAA',
          decimals: 18,
          value: 1,
          balance: normalizedBalance(1n, 1)
        }
      },
      10: {
        [getAddress(CHAIN10_TOKEN)]: {
          address: getAddress(CHAIN10_TOKEN),
          chainID: 10,
          symbol: 'OP',
          name: 'Optimism',
          decimals: 18,
          value: 2,
          balance: normalizedBalance(2n, 2)
        }
      }
    }

    const nextData = mergeStagedQueryData({
      previousData,
      priorityChainIds: [1],
      priorityQueryData: [
        {
          [getAddress(CHAIN1_TOKEN_A)]: {
            address: getAddress(CHAIN1_TOKEN_A),
            chainID: 1,
            symbol: 'AAA',
            name: 'Token AAA',
            decimals: 18,
            value: 1,
            balance: normalizedBalance(1n, 1)
          }
        }
      ],
      secondaryChainIds: [10],
      secondaryQueryData: [
        {
          [getAddress(CHAIN10_TOKEN)]: {
            address: getAddress(CHAIN10_TOKEN),
            chainID: 10,
            symbol: 'OP',
            name: 'Optimism',
            decimals: 18,
            value: 2,
            balance: normalizedBalance(2n, 2)
          }
        }
      ]
    })

    expect(nextData).toBe(previousData)
  })

  it('preserves unchanged chain branches when only one staged chain changes', () => {
    const previousData: TChainTokens = {
      1: {
        [getAddress(CHAIN1_TOKEN_A)]: {
          address: getAddress(CHAIN1_TOKEN_A),
          chainID: 1,
          symbol: 'AAA',
          name: 'Token AAA',
          decimals: 18,
          value: 1,
          balance: normalizedBalance(1n, 1)
        }
      },
      10: {
        [getAddress(CHAIN10_TOKEN)]: {
          address: getAddress(CHAIN10_TOKEN),
          chainID: 10,
          symbol: 'OP',
          name: 'Optimism',
          decimals: 18,
          value: 2,
          balance: normalizedBalance(2n, 2)
        }
      }
    }

    const nextData = mergeStagedQueryData({
      previousData,
      priorityChainIds: [1],
      priorityQueryData: [previousData[1]],
      secondaryChainIds: [10],
      secondaryQueryData: [
        {
          [getAddress(CHAIN10_TOKEN)]: {
            address: getAddress(CHAIN10_TOKEN),
            chainID: 10,
            symbol: 'OP',
            name: 'Optimism',
            decimals: 18,
            value: 3,
            balance: normalizedBalance(3n, 3)
          }
        }
      ]
    })

    expect(nextData).not.toBe(previousData)
    expect(nextData[1]).toBe(previousData[1])
    expect(nextData[10]).not.toBe(previousData[10])
  })
})
