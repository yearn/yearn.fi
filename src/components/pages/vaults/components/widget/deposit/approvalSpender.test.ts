import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
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
})
