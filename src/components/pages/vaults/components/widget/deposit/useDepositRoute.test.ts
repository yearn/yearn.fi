import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { resolveDepositRouteType } from './useDepositRoute'

const ASSET = '0x0000000000000000000000000000000000000001' as Address
const VAULT = '0x0000000000000000000000000000000000000002' as Address
const STAKING = '0x0000000000000000000000000000000000000003' as Address
const OTHER = '0x0000000000000000000000000000000000000004' as Address

describe('resolveDepositRouteType', () => {
  it('returns DIRECT_DEPOSIT for asset-to-vault deposits', () => {
    const route = resolveDepositRouteType({
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
      depositToken: OTHER,
      assetAddress: ASSET,
      destinationToken: VAULT,
      vaultAddress: VAULT,
      stakingAddress: STAKING,
      ensoEnabled: false
    })

    expect(route).toBe('NO_ROUTE')
  })
})
