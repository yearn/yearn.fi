import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TSwapSelection } from './swapParams'
import { buildSwapVaultPolicyEntries, getSwapSelectionPolicy } from './swapPolicy'

const TOKEN_A = '0x0000000000000000000000000000000000000001' as Address
const TOKEN_B = '0x0000000000000000000000000000000000000002' as Address
const VAULT = '0x0000000000000000000000000000000000000003' as Address
const STAKING = '0x0000000000000000000000000000000000000004' as Address

const selection: TSwapSelection = {
  fromChainId: 1,
  fromToken: TOKEN_A,
  toChainId: 1,
  toToken: TOKEN_B
}

describe('getSwapSelectionPolicy', () => {
  it('builds policy entries for both vault shares and staking aliases', () => {
    const entries = buildSwapVaultPolicyEntries({
      [VAULT]: {
        address: VAULT,
        chainId: 1,
        isHidden: true,
        isRetired: false,
        staking: { address: STAKING, available: true, source: '', rewards: [] }
      } as unknown as TKongVaultListItem
    })

    expect(entries).toEqual([
      {
        address: VAULT,
        chainId: 1,
        isHidden: true,
        isRetired: false,
        stakingAddress: STAKING
      }
    ])
  })

  it('blocks hidden vault shares and staking aliases on either side', () => {
    const entries = [
      {
        address: VAULT,
        stakingAddress: STAKING,
        chainId: 1,
        isHidden: true,
        isRetired: false
      }
    ]

    expect(
      getSwapSelectionPolicy({ entries, isLoading: false, selection: { ...selection, fromToken: VAULT } })
    ).toMatchObject({ isAllowed: false, message: 'Hidden vault tokens cannot be swapped.' })
    expect(
      getSwapSelectionPolicy({ entries, isLoading: false, selection: { ...selection, toToken: STAKING } })
    ).toMatchObject({ isAllowed: false, message: 'Hidden vault tokens cannot be swapped.' })
  })

  it('allows retired vault sources but blocks retired destinations and staking aliases', () => {
    const entries = [
      {
        address: VAULT,
        stakingAddress: STAKING,
        chainId: 1,
        isHidden: false,
        isRetired: true
      }
    ]

    expect(
      getSwapSelectionPolicy({ entries, isLoading: false, selection: { ...selection, fromToken: VAULT } })
    ).toEqual({ isAllowed: true, isReady: true })
    expect(
      getSwapSelectionPolicy({ entries, isLoading: false, selection: { ...selection, toToken: STAKING } })
    ).toMatchObject({ isAllowed: false, message: expect.stringContaining('Retired vault tokens') })
  })

  it('allows arbitrary non-vault tokens after the registry is ready', () => {
    expect(getSwapSelectionPolicy({ entries: [], isLoading: false, selection })).toEqual({
      isAllowed: true,
      isReady: true
    })
  })

  it('blocks quote preparation while the registry is loading', () => {
    expect(getSwapSelectionPolicy({ entries: [], isLoading: true, selection })).toEqual({
      isAllowed: false,
      isReady: false
    })
  })
})
