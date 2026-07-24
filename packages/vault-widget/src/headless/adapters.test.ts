import { decodeFunctionData, type PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetRequest, VaultWidgetToken } from '../types'
import {
  createEnsoAdapter,
  createErc4626Adapter,
  createErc4626PositionValueReader,
  createYBoldAdapter,
  createYearnV2Adapter,
  createYearnV2PositionValueReader,
  YEARN_V2_VAULT_ABI
} from './adapters'

const asset: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  symbol: 'ASSET'
}
const positionToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'POSITION'
}
const routeToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 6,
  symbol: 'ROUTE'
}
const vault = '0x4444444444444444444444444444444444444444'
const zapper = '0x5555555555555555555555555555555555555555'
const router = '0x6666666666666666666666666666666666666666'

describe('adapter approval targets', () => {
  it('resolves ERC-4626 deposit approval without a quote', () => {
    const adapter = createErc4626Adapter({ asset, vaultAddress: vault })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'deposit', selectedToken: asset })).toEqual({
      spender: vault,
      token: asset
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'withdraw', selectedToken: asset })).toBeUndefined()
  })

  it('resolves yBOLD withdrawal approval without a quote', () => {
    const adapter = createYBoldAdapter({
      asset,
      positionToken,
      stakingAbi: [],
      zapperAbi: [],
      zapperAddress: zapper
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'withdraw', selectedToken: asset })).toEqual({
      spender: zapper,
      token: positionToken
    })
  })

  it('resolves Enso route-token approval without a quote', () => {
    const adapter = createEnsoAdapter({
      asset,
      destinationChainId: 1,
      positionToken,
      provider: {
        getRoute: async () => {
          throw new Error('not called')
        }
      },
      routerByChain: { 1: router }
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'deposit', selectedToken: routeToken })).toEqual({
      spender: router,
      token: routeToken
    })
  })
})

describe('Enso adapter', () => {
  const crossChainToken: VaultWidgetToken = { ...routeToken, chainId: 10 }
  const request: VaultWidgetRequest = {
    account: '0x7777777777777777777777777777777777777777',
    amount: 1_000_000n,
    chainId: 10,
    maxLossBps: 100,
    mode: 'deposit',
    positionBalance: 0n,
    selectedToken: crossChainToken,
    signal: new AbortController().signal,
    slippageBps: 100
  }
  const route = {
    amountOut: 90n,
    minAmountOut: 88n,
    transaction: {
      chainId: 10,
      data: '0x1234' as const,
      from: request.account,
      to: router,
      value: 0n
    }
  } as const

  it('requires verifiable bridge tracking for cross-chain routes', async () => {
    const adapter = createEnsoAdapter({
      asset,
      destinationChainId: 1,
      positionToken,
      provider: { getRoute: async () => route },
      routerByChain: { 10: router }
    })

    await expect(adapter.quote(request, {} as PublicClient)).rejects.toThrow('bridge tracking')
  })

  it('preserves validated bridge metadata in the transaction quote', async () => {
    const bridge = {
      destinationChainId: 1,
      protocol: 'relay' as const,
      sourceChainId: 10
    }
    const adapter = createEnsoAdapter({
      asset,
      destinationChainId: 1,
      positionToken,
      provider: { getRoute: async () => ({ ...route, bridge }) },
      routerByChain: { 10: router }
    })

    await expect(adapter.quote(request, {} as PublicClient)).resolves.toMatchObject({
      bridge,
      isCrossChain: true
    })
  })
})

describe('ERC-4626 position value', () => {
  it('previews the asset value of vault shares', async () => {
    const readContract = vi.fn().mockResolvedValue(125n)
    const readPositionValue = createErc4626PositionValueReader({ vaultAddress: vault })

    await expect(readPositionValue({ readContract } as unknown as PublicClient, 100n)).resolves.toBe(125n)
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: vault,
        functionName: 'previewRedeem',
        args: [100n]
      })
    )
  })
})

describe('Yearn V2 adapter', () => {
  const createRequest = (mode: 'deposit' | 'withdraw', amount: bigint, maxLossBps = 100): VaultWidgetRequest => ({
    account: '0x7777777777777777777777777777777777777777',
    amount,
    chainId: 1,
    maxLossBps,
    mode,
    positionBalance: 100n * 10n ** 18n,
    selectedToken: asset,
    signal: new AbortController().signal,
    slippageBps: 50
  })
  const createClient = (pricePerShare: bigint): PublicClient =>
    ({
      readContract: vi.fn().mockResolvedValue(pricePerShare)
    }) as unknown as PublicClient

  it('quotes a deposit from pricePerShare and targets the V2 deposit overload', async () => {
    const adapter = createYearnV2Adapter({ asset, positionToken, vaultAddress: vault })
    const quote = await adapter.quote(createRequest('deposit', 10n * 10n ** 18n), createClient(2n * 10n ** 18n))
    const transaction = decodeFunctionData({ abi: YEARN_V2_VAULT_ABI, data: quote.transaction.data })

    expect(quote).toMatchObject({
      adapterId: 'yearn-v2',
      amountIn: 10n * 10n ** 18n,
      expectedOut: 5n * 10n ** 18n,
      positionAmount: 5n * 10n ** 18n
    })
    expect(quote.approval).toMatchObject({
      amount: 10n * 10n ** 18n,
      spender: vault,
      token: asset
    })
    expect(transaction).toEqual({
      functionName: 'deposit',
      args: [10n * 10n ** 18n, '0x7777777777777777777777777777777777777777']
    })
  })

  it('rounds withdrawal shares up and includes the configured maximum loss', async () => {
    const adapter = createYearnV2Adapter({ asset, positionToken, vaultAddress: vault })
    const quote = await adapter.quote(
      createRequest('withdraw', 5n * 10n ** 18n + 1n, 75),
      createClient(2n * 10n ** 18n)
    )
    const transaction = decodeFunctionData({ abi: YEARN_V2_VAULT_ABI, data: quote.transaction.data })

    expect(quote.positionAmount).toBe(2500000000000000001n)
    expect(quote.expectedOut).toBe(5n * 10n ** 18n + 1n)
    expect(quote.approval).toBeUndefined()
    expect(transaction).toEqual({
      functionName: 'withdraw',
      args: [2500000000000000001n, '0x7777777777777777777777777777777777777777', 75n]
    })
  })

  it('values V2 shares with the same pricePerShare scale as the legacy widget', async () => {
    const readPositionValue = createYearnV2PositionValueReader({
      positionToken,
      vaultAddress: vault
    })

    await expect(readPositionValue(createClient(125n * 10n ** 16n), 4n * 10n ** 18n)).resolves.toBe(5n * 10n ** 18n)
  })
})
