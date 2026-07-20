import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'
import { getVaultUserHistoryVaults } from './vaultUserHistoryVaults'

describe('getVaultUserHistoryVaults', () => {
  it('combines yvUSD unlocked and locked vaults', () => {
    expect(getVaultUserHistoryVaults({ chainId: 1, vaultAddress: YVUSD_UNLOCKED_ADDRESS })).toStrictEqual([
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_UNLOCKED_ADDRESS },
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_LOCKED_ADDRESS }
    ])
  })

  it('combines yBOLD and staked yBOLD vaults', () => {
    expect(getVaultUserHistoryVaults({ chainId: 1, vaultAddress: YBOLD_VAULT_ADDRESS })).toStrictEqual([
      { chainId: 1, vaultAddress: YBOLD_VAULT_ADDRESS },
      { chainId: 1, vaultAddress: YBOLD_STAKING_ADDRESS }
    ])
  })

  it('keeps ordinary vaults scoped to the selected vault', () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'

    expect(getVaultUserHistoryVaults({ chainId: 10, vaultAddress })).toStrictEqual([{ chainId: 10, vaultAddress }])
  })
})
