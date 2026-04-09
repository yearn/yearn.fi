import type { Token } from '@pages/vaults/hooks/useTokens'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useWithdrawNotifications } from './useWithdrawNotifications'

describe('useWithdrawNotifications', () => {
  it('creates bridge notification payloads for Katana native bridge withdrawals', () => {
    const emptyBalance = {
      raw: 0n,
      normalized: 0,
      display: '0',
      decimals: 6
    }
    const vaultToken = {
      address: '0x0000000000000000000000000000000000000001',
      symbol: 'yvKatanaUSDC',
      decimals: 18,
      balance: { ...emptyBalance, decimals: 18 }
    } as Token
    const assetToken = {
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'vbUSDC',
      decimals: 6,
      balance: emptyBalance
    } as Token
    const outputToken = {
      address: '0x0000000000000000000000000000000000000003',
      symbol: 'USDC',
      decimals: 6,
      balance: emptyBalance
    } as Token

    const resultRef: {
      approveNotificationParams?: ReturnType<typeof useWithdrawNotifications>['approveNotificationParams']
      withdrawNotificationParams?: ReturnType<typeof useWithdrawNotifications>['withdrawNotificationParams']
      bridgeNotificationParams?: ReturnType<typeof useWithdrawNotifications>['bridgeNotificationParams']
    } = {}

    function HookHarness() {
      ;({
        approveNotificationParams: resultRef.approveNotificationParams,
        withdrawNotificationParams: resultRef.withdrawNotificationParams,
        bridgeNotificationParams: resultRef.bridgeNotificationParams
      } = useWithdrawNotifications({
        vault: vaultToken,
        assetToken,
        outputToken,
        vaultAddress: '0x0000000000000000000000000000000000000001',
        sourceToken: '0x0000000000000000000000000000000000000001',
        assetAddress: '0x0000000000000000000000000000000000000002',
        withdrawToken: '0x0000000000000000000000000000000000000003',
        account: '0x0000000000000000000000000000000000000004',
        chainId: 747474,
        destinationChainId: 1,
        withdrawAmount: 1_250_000n,
        requiredShares: 1_000_000_000_000_000_000n,
        expectedOut: 1_250_000n,
        routeType: 'KATANA_NATIVE_BRIDGE',
        routerAddress: '0x0000000000000000000000000000000000000005',
        isCrossChain: true,
        withdrawalSource: 'vault'
      }))

      return null
    }

    renderToStaticMarkup(createElement(HookHarness))

    expect(resultRef.approveNotificationParams).toEqual({
      type: 'approve',
      amount: '1.25',
      fromAddress: '0x0000000000000000000000000000000000000002',
      fromSymbol: 'vbUSDC',
      fromChainId: 747474,
      toAddress: '0x0000000000000000000000000000000000000005',
      toSymbol: 'Katana Unified Bridge'
    })

    expect(resultRef.withdrawNotificationParams).toEqual({
      type: 'withdraw',
      amount: '1.00',
      fromAddress: '0x0000000000000000000000000000000000000001',
      fromSymbol: 'yvKatanaUSDC',
      fromChainId: 747474,
      toAddress: '0x0000000000000000000000000000000000000002',
      toSymbol: 'vbUSDC',
      toAmount: '1.25'
    })

    expect(resultRef.bridgeNotificationParams).toEqual({
      type: 'bridge',
      amount: '1.25',
      rawAmount: '1250000',
      fromAddress: '0x0000000000000000000000000000000000000002',
      fromSymbol: 'vbUSDC',
      fromChainId: 747474,
      toAddress: '0x0000000000000000000000000000000000000003',
      toSymbol: 'USDC',
      toChainId: 1,
      vaultAddress: '0x0000000000000000000000000000000000000001',
      bridgeDirection: 'to-ethereum',
      trackingUrl: 'https://bridge.katana.network/transactions'
    })
  })
})
