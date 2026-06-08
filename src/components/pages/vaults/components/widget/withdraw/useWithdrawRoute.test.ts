import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { BOLD_ADDRESS } from '@pages/vaults/utils/yBold'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { resolveWithdrawRouteType } from './useWithdrawRoute'

const ASSET = '0x0000000000000000000000000000000000000001' as Address
const OTHER = '0x0000000000000000000000000000000000000002' as Address
const VAULT = '0x0000000000000000000000000000000000000003' as Address

describe('resolveWithdrawRouteType', () => {
  it('returns DIRECT_UNSTAKE when withdrawing as unstake flow', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: VAULT,
      sourceToken: VAULT,
      withdrawToken: ASSET,
      assetAddress: ASSET,
      stakingAddress: OTHER,
      withdrawalSource: 'staking',
      chainId: 1,
      outputChainId: 1,
      isUnstake: true,
      ensoEnabled: false
    })

    expect(route).toBe('DIRECT_UNSTAKE')
  })

  it('returns DIRECT_WITHDRAW for same-asset vault withdrawals on same chain', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: VAULT,
      sourceToken: VAULT,
      withdrawToken: ASSET,
      assetAddress: ASSET,
      stakingAddress: OTHER,
      withdrawalSource: 'vault',
      chainId: 1,
      outputChainId: 1,
      isUnstake: false,
      ensoEnabled: true
    })

    expect(route).toBe('DIRECT_WITHDRAW')
  })

  it('returns ENSO for non-direct routes when Enso is enabled', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: VAULT,
      sourceToken: VAULT,
      withdrawToken: OTHER,
      assetAddress: ASSET,
      stakingAddress: OTHER,
      withdrawalSource: 'vault',
      chainId: 1,
      outputChainId: 1,
      isUnstake: false,
      ensoEnabled: true
    })

    expect(route).toBe('ENSO')
  })

  it('returns DIRECT_WITHDRAW for non-direct routes when Enso is disabled', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: VAULT,
      sourceToken: VAULT,
      withdrawToken: OTHER,
      assetAddress: ASSET,
      stakingAddress: OTHER,
      withdrawalSource: 'vault',
      chainId: 1,
      outputChainId: 10,
      isUnstake: false,
      ensoEnabled: false
    })

    expect(route).toBe('DIRECT_WITHDRAW')
  })

  it('returns YBOLD_ZAPPER_WITHDRAW for mainnet staked yBOLD to BOLD withdrawals', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: YBOLD_VAULT_ADDRESS,
      sourceToken: YBOLD_STAKING_ADDRESS,
      withdrawToken: BOLD_ADDRESS,
      assetAddress: BOLD_ADDRESS,
      stakingAddress: YBOLD_STAKING_ADDRESS,
      withdrawalSource: 'staking',
      chainId: 1,
      outputChainId: 1,
      isUnstake: false,
      ensoEnabled: true
    })

    expect(route).toBe('YBOLD_ZAPPER_WITHDRAW')
  })

  it('falls back to DIRECT_UNSTAKE_WITHDRAW for staked yBOLD to BOLD off mainnet', () => {
    const route = resolveWithdrawRouteType({
      vaultAddress: YBOLD_VAULT_ADDRESS,
      sourceToken: YBOLD_STAKING_ADDRESS,
      withdrawToken: BOLD_ADDRESS,
      assetAddress: BOLD_ADDRESS,
      stakingAddress: YBOLD_STAKING_ADDRESS,
      withdrawalSource: 'staking',
      chainId: 10,
      outputChainId: 10,
      isUnstake: false,
      ensoEnabled: true
    })

    expect(route).toBe('DIRECT_UNSTAKE_WITHDRAW')
  })
})
