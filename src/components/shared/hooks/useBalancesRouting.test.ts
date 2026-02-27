import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TUseBalancesTokens } from './useBalances.multichains'
import { partitionTokensByBalanceSource } from './useBalancesRouting'

const VAULT_A = '0x1111111111111111111111111111111111111111'
const STAKING_A = '0x2222222222222222222222222222222222222222'
const VAULT_B = '0x3333333333333333333333333333333333333333'
const STAKING_B = '0x4444444444444444444444444444444444444444'
const VAULT_C = '0x5555555555555555555555555555555555555555'

function tokenKey(token: TUseBalancesTokens): string {
  return `${token.chainID}:${getAddress(token.address)}`
}

describe('partitionTokensByBalanceSource', () => {
  it('routes staking-only pair tokens to multicall', () => {
    const tokens: TUseBalancesTokens[] = [
      {
        address: VAULT_A,
        chainID: 1,
        for: 'vault',
        isVaultToken: true,
        isStakingOnlyPair: true,
        pairedStakingAddress: STAKING_A
      },
      {
        address: STAKING_A,
        chainID: 1,
        for: 'staking',
        isStakingToken: true,
        isStakingOnlyPair: true,
        pairedVaultAddress: VAULT_A
      }
    ]

    const { ensoTokens, multicallTokens } = partitionTokensByBalanceSource(tokens, [])
    expect(ensoTokens).toHaveLength(0)
    expect(multicallTokens.map(tokenKey)).toEqual([`1:${getAddress(VAULT_A)}`, `1:${getAddress(STAKING_A)}`])
  })

  it('routes vault-backed staking tokens to enso on supported chains', () => {
    const tokens: TUseBalancesTokens[] = [
      {
        address: VAULT_B,
        chainID: 1,
        for: 'vault',
        isVaultToken: true,
        isVaultBackedStaking: true,
        pairedStakingAddress: STAKING_B
      },
      {
        address: STAKING_B,
        chainID: 1,
        for: 'staking',
        isVaultToken: true,
        isStakingToken: true,
        isVaultBackedStaking: true,
        pairedVaultAddress: VAULT_B
      }
    ]

    const { ensoTokens, multicallTokens } = partitionTokensByBalanceSource(tokens, [])
    expect(multicallTokens).toHaveLength(0)
    expect(ensoTokens.map(tokenKey)).toEqual([`1:${getAddress(VAULT_B)}`, `1:${getAddress(STAKING_B)}`])
  })

  it('routes unsupported chains to multicall even for vault-backed staking', () => {
    const tokens: TUseBalancesTokens[] = [
      {
        address: STAKING_B,
        chainID: 250,
        for: 'staking',
        isStakingToken: true,
        isVaultBackedStaking: true
      }
    ]

    const { ensoTokens, multicallTokens } = partitionTokensByBalanceSource(tokens, [250])
    expect(ensoTokens).toHaveLength(0)
    expect(multicallTokens.map(tokenKey)).toEqual([`250:${getAddress(STAKING_B)}`])
  })

  it('dedupes duplicate entries and never routes same token to both sources', () => {
    const tokens: TUseBalancesTokens[] = [
      { address: VAULT_A, chainID: 1, for: 'vault' },
      { address: VAULT_A, chainID: 1 },
      { address: VAULT_C, chainID: 1, for: 'vault', isStakingOnlyPair: true, pairedStakingAddress: STAKING_A },
      { address: STAKING_A, chainID: 1, for: 'staking' },
      { address: STAKING_A, chainID: 1, isStakingToken: true, isStakingOnlyPair: true, pairedVaultAddress: VAULT_C }
    ]

    const { ensoTokens, multicallTokens } = partitionTokensByBalanceSource(tokens, [])
    const ensoKeys = new Set(ensoTokens.map(tokenKey))
    const multicallKeys = new Set(multicallTokens.map(tokenKey))
    const overlap = [...ensoKeys].filter((key) => multicallKeys.has(key))

    expect(overlap).toHaveLength(0)
    expect([...ensoKeys]).toEqual([`1:${getAddress(VAULT_A)}`])
    expect([...multicallKeys]).toEqual([`1:${getAddress(VAULT_C)}`, `1:${getAddress(STAKING_A)}`])
  })
})
