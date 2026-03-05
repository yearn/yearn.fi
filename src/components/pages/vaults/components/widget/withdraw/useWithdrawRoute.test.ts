import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { resolveWithdrawRouteType } from './useWithdrawRoute'

const ASSET = '0x0000000000000000000000000000000000000001' as Address
const OTHER = '0x0000000000000000000000000000000000000002' as Address

describe('resolveWithdrawRouteType', () => {
  it('returns DIRECT_UNSTAKE when withdrawing as unstake flow', () => {
    const route = resolveWithdrawRouteType({
      withdrawToken: ASSET,
      assetAddress: ASSET,
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
      withdrawToken: ASSET,
      assetAddress: ASSET,
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
      withdrawToken: OTHER,
      assetAddress: ASSET,
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
      withdrawToken: OTHER,
      assetAddress: ASSET,
      withdrawalSource: 'vault',
      chainId: 1,
      outputChainId: 10,
      isUnstake: false,
      ensoEnabled: false
    })

    expect(route).toBe('DIRECT_WITHDRAW')
  })
})
