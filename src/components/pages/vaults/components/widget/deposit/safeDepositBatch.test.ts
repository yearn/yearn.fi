import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { buildSafeDepositBatch } from './safeDepositBatch'

const ACCOUNT: Address = '0x1111111111111111111111111111111111111111'
const UNREGISTERED_STAKING: Address = '0x2222222222222222222222222222222222222222'

describe('buildSafeDepositBatch', () => {
  it('builds direct stake approval and execution calls for registered staking metadata', () => {
    const batch = buildSafeDepositBatch({
      routeType: 'DIRECT_STAKE',
      account: ACCOUNT,
      depositToken: YBOLD_VAULT_ADDRESS,
      amount: 100n,
      chainId: 1,
      vaultAddress: YBOLD_VAULT_ADDRESS,
      stakingAddress: YBOLD_STAKING_ADDRESS,
      stakingSource: 'yBOLD',
      approvalSpenderAddress: YBOLD_STAKING_ADDRESS
    })

    expect(batch?.calls).toHaveLength(2)
    expect(batch?.calls[0].to).toBe(YBOLD_VAULT_ADDRESS)
    expect(batch?.calls[1].to).toBe(YBOLD_STAKING_ADDRESS)
  })

  it('does not build Safe direct stake calldata for unregistered staking metadata', () => {
    expect(
      buildSafeDepositBatch({
        routeType: 'DIRECT_STAKE',
        account: ACCOUNT,
        depositToken: YBOLD_VAULT_ADDRESS,
        amount: 100n,
        chainId: 1,
        vaultAddress: YBOLD_VAULT_ADDRESS,
        stakingAddress: UNREGISTERED_STAKING,
        stakingSource: 'yBOLD',
        approvalSpenderAddress: UNREGISTERED_STAKING
      })
    ).toBeUndefined()
  })

  it('does not approve a spender that differs from the registered staking contract', () => {
    expect(
      buildSafeDepositBatch({
        routeType: 'DIRECT_STAKE',
        account: ACCOUNT,
        depositToken: YBOLD_VAULT_ADDRESS,
        amount: 100n,
        chainId: 1,
        vaultAddress: YBOLD_VAULT_ADDRESS,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD',
        approvalSpenderAddress: UNREGISTERED_STAKING
      })
    ).toBeUndefined()
  })
})
