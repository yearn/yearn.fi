import { describe, expect, it } from 'vitest'
import type { VaultWidgetToken } from '../types'
import { createStakingPreset } from './staking'

const vaultToken: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  symbol: 'yvUSDC'
}
const stakingToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'styvUSDC'
}

describe('createStakingPreset', () => {
  it('configures a complete stake and unstake surface', () => {
    const config = createStakingPreset({
      chainId: 1,
      name: 'Staked yvUSDC',
      source: 'VeYFI',
      stakingAddress: stakingToken.address,
      stakingToken,
      vaultAddress: vaultToken.address,
      vaultToken
    })

    expect(config.vaultAddress).toBe(vaultToken.address)
    expect(config.adapters[0]?.id).toBe('staking-veyfi')
    expect(config.modes).toEqual(['deposit', 'withdraw', 'info'])
    expect(config.display?.modeLabels).toMatchObject({
      deposit: 'Stake',
      withdraw: 'Unstake'
    })
    expect(config.copy).toMatchObject({
      submitDeposit: 'Stake',
      submitWithdraw: 'Unstake'
    })
    expect(config.readPositionValue).toBeTypeOf('function')
  })
})
