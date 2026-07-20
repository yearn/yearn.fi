import { describe, expect, it } from 'vitest'
import { getKnownEnsoRouterAddress, getValidatedEnsoRouterAddress } from './ensoRouters'

describe('getValidatedEnsoRouterAddress', () => {
  it('accepts a known Enso router for the selected chain', () => {
    expect(
      getValidatedEnsoRouterAddress({
        chainId: 1,
        routerAddress: '0xf75584ef6673ad213a685a1b58cc0330b8ea22cf',
        routeChainId: 1
      })
    ).toBe(getKnownEnsoRouterAddress(1))
  })

  it('rejects unknown router addresses for a supported chain', () => {
    expect(
      getValidatedEnsoRouterAddress({
        chainId: 1,
        routerAddress: '0x00000000000000000000000000000000000000bb',
        routeChainId: 1
      })
    ).toBe(undefined)
  })

  it('rejects known router addresses on the wrong route chain', () => {
    expect(
      getValidatedEnsoRouterAddress({
        chainId: 1,
        routerAddress: getKnownEnsoRouterAddress(1),
        routeChainId: 10
      })
    ).toBe(undefined)
  })
})
