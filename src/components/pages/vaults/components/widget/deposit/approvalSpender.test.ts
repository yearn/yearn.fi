import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE, getKnownEnsoRouterAddress } from '@pages/vaults/utils/ensoRouters'
import { getDepositApprovalSpender } from './approvalSpender'

describe('getDepositApprovalSpender', () => {
  it('uses the zap router for direct deposit routes when a router address is present', () => {
    expect(
      getDepositApprovalSpender({
        routeType: 'DIRECT_DEPOSIT',
        destinationToken: '0x00000000000000000000000000000000000000aa',
        routerAddress: '0x00000000000000000000000000000000000000bb',
        vaultSymbol: 'yvUSD'
      })
    ).toEqual({
      spenderAddress: getAddress('0x00000000000000000000000000000000000000bb'),
      spenderName: 'Yearn Zap'
    })
  })

  it('falls back to the vault for plain direct deposits', () => {
    expect(
      getDepositApprovalSpender({
        routeType: 'DIRECT_DEPOSIT',
        destinationToken: '0x00000000000000000000000000000000000000aa',
        vaultSymbol: 'yvUSD'
      })
    ).toEqual({
      spenderAddress: getAddress('0x00000000000000000000000000000000000000aa'),
      spenderName: 'yvUSD'
    })
  })

  it('uses a known Enso router for Enso deposit approvals', () => {
    const routerAddress = getKnownEnsoRouterAddress(1)!

    expect(
      getDepositApprovalSpender({
        routeType: 'ENSO',
        chainId: 1,
        destinationToken: '0x00000000000000000000000000000000000000aa',
        routerAddress: routerAddress.toLowerCase(),
        vaultSymbol: 'yvUSD'
      })
    ).toEqual({
      spenderAddress: routerAddress,
      spenderName: 'Enso Router'
    })
  })

  it('returns a blocking warning for unknown Enso router addresses', () => {
    expect(
      getDepositApprovalSpender({
        routeType: 'ENSO',
        chainId: 1,
        destinationToken: '0x00000000000000000000000000000000000000aa',
        routerAddress: '0x00000000000000000000000000000000000000bb',
        vaultSymbol: 'yvUSD'
      })
    ).toEqual({
      spenderAddress: getAddress('0x00000000000000000000000000000000000000bb'),
      spenderName: 'Enso Router',
      approvalWarning: UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE
    })
  })

  it('returns a blocking warning for known Enso routers on unsupported chains', () => {
    const routerAddress = getKnownEnsoRouterAddress(1)!

    expect(
      getDepositApprovalSpender({
        routeType: 'ENSO',
        chainId: 999999,
        destinationToken: '0x00000000000000000000000000000000000000aa',
        routerAddress,
        vaultSymbol: 'yvUSD'
      })
    ).toEqual({
      spenderAddress: routerAddress,
      spenderName: 'Enso Router',
      approvalWarning: UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE
    })
  })
})
