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
  ERC4626_ABI,
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
const account = '0x7777777777777777777777777777777777777777'

function createRequest(mode: 'deposit' | 'withdraw', amount: bigint, token = asset): VaultWidgetRequest {
  return {
    account,
    amount,
    chainId: token.chainId,
    maxLossBps: 75,
    mode,
    positionBalance: 100n * 10n ** 18n,
    selectedToken: token,
    signal: new AbortController().signal,
    slippageBps: 50
  }
}

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

describe('ERC-4626 adapter', () => {
  it('characterizes direct deposit and withdrawal targets, calldata, and approvals', async () => {
    const adapter = createErc4626Adapter({ asset, vaultAddress: vault })
    const readContract = vi.fn().mockResolvedValueOnce(8n).mockResolvedValueOnce(6n)
    const client = { readContract } as unknown as PublicClient

    const deposit = await adapter.quote(createRequest('deposit', 5n), client)
    const withdraw = await adapter.quote(createRequest('withdraw', 5n), client)

    expect(deposit).toMatchObject({
      adapterId: 'erc4626',
      amountIn: 5n,
      expectedOut: 8n,
      positionAmount: 8n,
      approval: { amount: 5n, spender: vault, token: asset },
      transaction: { chainId: 1, to: vault }
    })
    expect(decodeFunctionData({ abi: ERC4626_ABI, data: deposit.transaction.data })).toEqual({
      functionName: 'deposit',
      args: [5n, account]
    })
    expect(withdraw).toMatchObject({
      adapterId: 'erc4626',
      amountIn: 6n,
      expectedOut: 5n,
      positionAmount: 6n,
      transaction: { chainId: 1, to: vault }
    })
    expect(withdraw.approval).toBeUndefined()
    expect(decodeFunctionData({ abi: ERC4626_ABI, data: withdraw.transaction.data })).toEqual({
      functionName: 'withdraw',
      args: [5n, account, account]
    })
  })
})

describe('yBOLD adapter', () => {
  const stakingAbi = [
    {
      type: 'function',
      name: 'previewWithdraw',
      stateMutability: 'view',
      inputs: [{ name: 'assets', type: 'uint256' }],
      outputs: [{ name: 'shares', type: 'uint256' }]
    }
  ] as const
  const zapperAbi = [
    {
      type: 'function',
      name: 'previewDeposit',
      stateMutability: 'view',
      inputs: [{ name: 'assets', type: 'uint256' }],
      outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
      type: 'function',
      name: 'previewRedeem',
      stateMutability: 'view',
      inputs: [{ name: 'shares', type: 'uint256' }],
      outputs: [{ name: 'assets', type: 'uint256' }]
    },
    {
      type: 'function',
      name: 'zapIn',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'assets', type: 'uint256' },
        { name: 'receiver', type: 'address' }
      ],
      outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
      type: 'function',
      name: 'zapOut',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'shares', type: 'uint256' },
        { name: 'receiver', type: 'address' },
        { name: 'maxLoss', type: 'uint256' }
      ],
      outputs: [{ name: 'assets', type: 'uint256' }]
    }
  ] as const

  it('characterizes direct zap-in and zap-out calldata and approval spenders', async () => {
    const adapter = createYBoldAdapter({
      asset,
      positionToken,
      stakingAbi,
      zapperAbi,
      zapperAddress: zapper
    })
    const readContract = vi.fn().mockResolvedValueOnce(9n).mockResolvedValueOnce(7n).mockResolvedValueOnce(6n)
    const client = { readContract } as unknown as PublicClient

    const deposit = await adapter.quote(createRequest('deposit', 5n), client)
    const withdraw = await adapter.quote(createRequest('withdraw', 5n), client)

    expect(deposit.approval).toEqual({ amount: 5n, spender: zapper, token: asset })
    expect(decodeFunctionData({ abi: zapperAbi, data: deposit.transaction.data })).toEqual({
      functionName: 'zapIn',
      args: [5n, account]
    })
    expect(withdraw).toMatchObject({
      amountIn: 7n,
      assetValue: 6n,
      expectedOut: 6n,
      positionAmount: 7n,
      approval: { amount: 7n, spender: zapper, token: positionToken }
    })
    expect(decodeFunctionData({ abi: zapperAbi, data: withdraw.transaction.data })).toEqual({
      functionName: 'zapOut',
      args: [7n, account, 75n]
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
      assetValue: undefined,
      bridge,
      isCrossChain: true
    })
  })

  it('does not read destination share values through the source-chain client', async () => {
    const readPositionValue = vi.fn()
    const adapter = createEnsoAdapter({
      asset,
      destinationChainId: 1,
      positionToken,
      provider: {
        getRoute: async () => ({
          ...route,
          bridge: {
            destinationChainId: 1,
            protocol: 'relay',
            sourceChainId: 10
          }
        })
      },
      readPositionValue,
      routerByChain: { 10: router }
    })

    await adapter.quote(request, {} as PublicClient)

    expect(readPositionValue).not.toHaveBeenCalled()
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
