import type { Token } from '@pages/vaults/hooks/useTokens'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useDepositNotifications } from './useDepositNotifications'

describe('useDepositNotifications', () => {
  it('creates a bridge notification payload for Katana native bridge deposits', () => {
    const emptyBalance = {
      raw: 0n,
      normalized: 0,
      display: '0',
      decimals: 6
    }
    const sourceToken = {
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'USDC',
      decimals: 6,
      balance: emptyBalance
    } as Token
    const assetToken = {
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'vbUSDC',
      decimals: 6,
      balance: emptyBalance
    } as Token
    const vaultToken = {
      address: '0x0000000000000000000000000000000000000003',
      symbol: 'yvKatanaUSDC',
      decimals: 18,
      balance: { ...emptyBalance, decimals: 18 }
    } as Token

    const resultRef: {
      depositNotificationParams?: ReturnType<typeof useDepositNotifications>['depositNotificationParams']
    } = {}

    function HookHarness() {
      ;({ depositNotificationParams: resultRef.depositNotificationParams } = useDepositNotifications({
        inputToken: sourceToken,
        assetToken,
        vault: vaultToken,
        depositToken: '0x0000000000000000000000000000000000000001',
        assetAddress: '0x0000000000000000000000000000000000000002',
        destinationToken: '0x0000000000000000000000000000000000000002',
        vaultAddress: '0x0000000000000000000000000000000000000003',
        account: '0x0000000000000000000000000000000000000004',
        sourceChainId: 1,
        chainId: 747474,
        depositAmount: 1_250_000n,
        routeType: 'KATANA_NATIVE_BRIDGE',
        isCrossChain: true
      }))

      return null
    }

    renderToStaticMarkup(createElement(HookHarness))

    expect(resultRef.depositNotificationParams).toEqual({
      type: 'bridge',
      amount: '1.25',
      rawAmount: '1250000',
      fromAddress: '0x0000000000000000000000000000000000000001',
      fromSymbol: 'USDC',
      fromChainId: 1,
      toAddress: '0x0000000000000000000000000000000000000002',
      toSymbol: 'vbUSDC',
      toChainId: 747474,
      destinationBalanceRaw: '0',
      vaultAddress: '0x0000000000000000000000000000000000000003',
      bridgeDirection: 'to-katana',
      trackingUrl: 'https://bridge.katana.network/transactions'
    })
  })
})
