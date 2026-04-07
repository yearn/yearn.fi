import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { resolveWithdrawRouteType } from './useWithdrawRoute'

const ASSET = '0x0000000000000000000000000000000000000001' as Address
const OTHER = '0x0000000000000000000000000000000000000002' as Address
const BRIDGE_DESTINATION = '0x0000000000000000000000000000000000000003' as Address

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

  it('returns KATANA_NATIVE_BRIDGE for supported Katana to mainnet bridge withdrawals', () => {
    const route = resolveWithdrawRouteType({
      withdrawToken: BRIDGE_DESTINATION,
      assetAddress: ASSET,
      withdrawalSource: 'vault',
      chainId: 747474,
      outputChainId: 1,
      isUnstake: false,
      ensoEnabled: false,
      allowKatanaNativeBridge: true,
      katanaBridgeDestinationTokenAddress: BRIDGE_DESTINATION
    })

    expect(route).toBe('KATANA_NATIVE_BRIDGE')
  })

  it('keeps Katana to mainnet bridge withdrawals blocked when bridge mode is not enabled', () => {
    const route = resolveWithdrawRouteType({
      withdrawToken: BRIDGE_DESTINATION,
      assetAddress: ASSET,
      withdrawalSource: 'vault',
      chainId: 747474,
      outputChainId: 1,
      isUnstake: false,
      ensoEnabled: false,
      katanaBridgeDestinationTokenAddress: BRIDGE_DESTINATION
    })

    expect(route).toBe('DIRECT_WITHDRAW')
  })
})
