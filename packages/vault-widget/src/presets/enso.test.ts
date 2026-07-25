import type { PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { EnsoQuoteProvider, VaultWidgetConfig, VaultWidgetRequest, VaultWidgetToken } from '../types'
import { withEnsoRoutes } from './enso'

const account = '0x1111111111111111111111111111111111111111'
const asset: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 6,
  symbol: 'USDC'
}
const vaultToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'yvUSDC'
}
const stakedToken: VaultWidgetToken = {
  address: '0x4444444444444444444444444444444444444444',
  chainId: 1,
  decimals: 18,
  symbol: 'styvUSDC'
}
const routeToken: VaultWidgetToken = {
  address: '0x5555555555555555555555555555555555555555',
  chainId: 10,
  decimals: 18,
  symbol: 'WETH'
}
const publicClient = {} as PublicClient

function request(overrides: Partial<VaultWidgetRequest> = {}): VaultWidgetRequest {
  return {
    account,
    amount: 1_000_000n,
    chainId: 10,
    maxLossBps: 100,
    mode: 'deposit',
    positionBalance: 0n,
    selectedToken: routeToken,
    signal: new AbortController().signal,
    slippageBps: 50,
    ...overrides
  }
}

function config(readAmount = vi.fn().mockResolvedValue(123n)): VaultWidgetConfig {
  return {
    adapters: [],
    chainId: 1,
    depositTokens: [asset],
    id: 'test',
    name: 'Test vault',
    positionSources: [
      { id: 'vault', label: 'Vault shares', readAmount, token: vaultToken },
      { id: 'staked', label: 'Staked shares', readAmount, token: stakedToken }
    ],
    positionToken: vaultToken,
    vaultAddress: vaultToken.address,
    withdrawTokens: [asset]
  }
}

describe('withEnsoRoutes', () => {
  it('adds route tokens and auto-stake-aware deposit adapters', async () => {
    const getRoute = vi.fn().mockResolvedValue({
      amountOut: 90n,
      bridge: { destinationChainId: 1, protocol: 'relay', sourceChainId: 10 },
      minAmountOut: 85n,
      priceImpactPercent: 0.1,
      transaction: {
        chainId: 10,
        data: '0x1234',
        from: account,
        to: '0x6666666666666666666666666666666666666666'
      }
    })
    const decorated = withEnsoRoutes(config(), {
      enso: { getRoute } as EnsoQuoteProvider,
      routeTokens: [routeToken]
    })
    const autoStakeAdapter = decorated.adapters.find((adapter) =>
      adapter.supports({
        autoStake: true,
        chainId: 10,
        mode: 'deposit',
        selectedToken: routeToken
      })
    )
    const quote = await autoStakeAdapter?.quote(request({ autoStake: true }), publicClient)

    expect(decorated.depositTokens).toContain(routeToken)
    expect(decorated.withdrawTokens).toContain(routeToken)
    expect(decorated.solvers).toContain('enso')
    expect(quote).toMatchObject({
      activityTokenOut: stakedToken.address,
      bridge: { destinationChainId: 1, sourceChainId: 10 },
      expectedOut: 90n
    })
    expect(getRoute).toHaveBeenCalledWith(expect.objectContaining({ tokenOut: stakedToken.address }))
  })

  it('converts underlying withdrawal units into the selected position source shares', async () => {
    const readAmount = vi.fn().mockResolvedValue(123n)
    const getRoute = vi.fn().mockResolvedValue({
      amountOut: 50n,
      bridge: { destinationChainId: 10, protocol: 'relay', sourceChainId: 1 },
      minAmountOut: 48n,
      priceImpactPercent: 0.1,
      transaction: {
        chainId: 1,
        data: '0x1234',
        from: account,
        to: '0x6666666666666666666666666666666666666666'
      }
    })
    const decorated = withEnsoRoutes(config(readAmount), {
      enso: { getRoute } as EnsoQuoteProvider,
      routeTokens: [routeToken]
    })
    const stakedSource = decorated.positionSources?.[1]
    const withdrawAdapter = decorated.adapters.find((adapter) =>
      adapter.supports({
        chainId: 1,
        mode: 'withdraw',
        positionSource: stakedSource,
        selectedToken: routeToken
      })
    )

    await withdrawAdapter?.quote(
      request({
        chainId: 1,
        mode: 'withdraw',
        positionBalance: 500n,
        positionSource: stakedSource
      }),
      publicClient
    )

    expect(readAmount).toHaveBeenCalledWith(publicClient, 1_000_000n)
    expect(getRoute).toHaveBeenCalledWith(
      expect.objectContaining({ amountIn: 123n, tokenIn: stakedToken.address, tokenOut: routeToken.address })
    )
  })
})
