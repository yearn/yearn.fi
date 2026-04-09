import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { resolveDepositRouteType } from './useDepositRoute'

const ASSET = '0x0000000000000000000000000000000000000001' as Address
const VAULT = '0x0000000000000000000000000000000000000002' as Address
const STAKING = '0x0000000000000000000000000000000000000003' as Address
const OTHER = '0x0000000000000000000000000000000000000004' as Address
const BRIDGE_SOURCE = '0x0000000000000000000000000000000000000005' as Address

describe('resolveDepositRouteType', () => {
  it('returns DIRECT_DEPOSIT for asset-to-vault deposits', () => {
    const route = resolveDepositRouteType({
      chainId: 1,
      depositToken: ASSET,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: false
    })

    expect(route).toBe('DIRECT_DEPOSIT')
  })

  it('returns DIRECT_STAKE for vault-to-staking deposits', () => {
    const route = resolveDepositRouteType({
      chainId: 1,
      depositToken: VAULT,
      assetAddress: ASSET,
      destinationToken: STAKING,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: false
    })

    expect(route).toBe('DIRECT_STAKE')
  })

  it('returns ENSO for non-direct routes when Enso is enabled', () => {
    const route = resolveDepositRouteType({
      chainId: 1,
      depositToken: OTHER,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: true
    })

    expect(route).toBe('ENSO')
  })

  it('returns NO_ROUTE for non-direct routes when Enso is disabled', () => {
    const route = resolveDepositRouteType({
      chainId: 1,
      depositToken: OTHER,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: false
    })

    expect(route).toBe('NO_ROUTE')
  })

  it('returns NO_ROUTE for Katana cross-chain deposits even when Enso is enabled', () => {
    const route = resolveDepositRouteType({
      chainId: 747474,
      sourceChainId: 1,
      depositToken: OTHER,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: true
    })

    expect(route).toBe('NO_ROUTE')
  })

  it('returns NO_ROUTE for deposits from Katana into a non-Katana vault even when Enso is enabled', () => {
    const route = resolveDepositRouteType({
      chainId: 1,
      sourceChainId: 747474,
      depositToken: OTHER,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: true
    })

    expect(route).toBe('NO_ROUTE')
  })

  it('returns KATANA_NATIVE_BRIDGE for supported mainnet to Katana bridge deposits', () => {
    const route = resolveDepositRouteType({
      chainId: 747474,
      sourceChainId: 1,
      depositToken: BRIDGE_SOURCE,
      assetAddress: ASSET,
      destinationToken: ASSET,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      allowKatanaNativeBridge: true,
      katanaBridgeSourceTokenAddress: BRIDGE_SOURCE,
      ensoEnabled: true
    })

    expect(route).toBe('KATANA_NATIVE_BRIDGE')
  })

  it('keeps mainnet to Katana deposits blocked when native bridge mode is not enabled', () => {
    const route = resolveDepositRouteType({
      chainId: 747474,
      sourceChainId: 1,
      depositToken: BRIDGE_SOURCE,
      assetAddress: ASSET,
      destinationToken: ASSET,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      katanaBridgeSourceTokenAddress: BRIDGE_SOURCE,
      ensoEnabled: true
    })

    expect(route).toBe('NO_ROUTE')
  })
})
