import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { describe, expect, it } from 'vitest'
import { YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS } from './yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS } from './yvUsd'
import { isRouteChainAddressMatch, resolveRouteVaultFromMap } from './routeVault'

const VAULT_ADDRESS = toAddress('0x1111111111111111111111111111111111111111')

function createVault({
  address = VAULT_ADDRESS,
  chainId = 1
}: {
  address?: string
  chainId?: number
}): TKongVaultInput {
  return {
    address: toAddress(address),
    chainId
  } as TKongVaultInput
}

describe('isRouteChainAddressMatch', () => {
  it('matches only when route chain and address both match', () => {
    expect(
      isRouteChainAddressMatch({
        routeChainId: YVUSD_CHAIN_ID,
        routeAddress: YVUSD_UNLOCKED_ADDRESS,
        expectedChainId: YVUSD_CHAIN_ID,
        expectedAddress: YVUSD_UNLOCKED_ADDRESS
      })
    ).toBe(true)
  })

  it('rejects matching addresses on the wrong route chain', () => {
    expect(
      isRouteChainAddressMatch({
        routeChainId: 10,
        routeAddress: YVBTC_UNLOCKED_ADDRESS,
        expectedChainId: YVBTC_CHAIN_ID,
        expectedAddress: YVBTC_UNLOCKED_ADDRESS
      })
    ).toBe(false)
  })
})

describe('resolveRouteVaultFromMap', () => {
  it('returns an address-matched vault when the route chain also matches', () => {
    const vault = createVault({ chainId: 1 })

    expect(resolveRouteVaultFromMap({ [VAULT_ADDRESS]: vault }, { routeChainId: 1, routeAddress: VAULT_ADDRESS })).toBe(
      vault
    )
  })

  it('rejects an address-matched vault when the route chain differs', () => {
    const vault = createVault({ chainId: 1 })

    expect(
      resolveRouteVaultFromMap({ [VAULT_ADDRESS]: vault }, { routeChainId: 10, routeAddress: VAULT_ADDRESS })
    ).toBe(undefined)
  })
})
