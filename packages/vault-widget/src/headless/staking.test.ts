import { decodeFunctionData, type PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetRequest, VaultWidgetToken } from '../types'
import { createErc4626Adapter, createYearnV2Adapter, ERC4626_ABI, YEARN_V2_VAULT_ABI } from './adapters'
import {
  createDepositAndStakeAdapter,
  createStakingAdapter,
  createStakingPositionValueReader,
  createUnstakeAndWithdrawAdapter,
  DEFAULT_STAKING_ABI,
  TOKENIZED_STAKING_ABI,
  VEYFI_STAKING_ABI
} from './staking'

const account = '0x1111111111111111111111111111111111111111'
const vaultToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'yvTOKEN'
}
const stakingToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'styvTOKEN'
}
const stakingAddress = stakingToken.address
const vaultAddress = '0x4444444444444444444444444444444444444444'
const assetToken: VaultWidgetToken = {
  address: '0x5555555555555555555555555555555555555555',
  chainId: 1,
  decimals: 18,
  symbol: 'TOKEN'
}

function createRequest(mode: 'deposit' | 'withdraw', amount = 100n): VaultWidgetRequest {
  return {
    account,
    amount,
    chainId: 1,
    maxLossBps: 100,
    mode,
    positionBalance: 1_000n,
    selectedToken: vaultToken,
    signal: new AbortController().signal,
    slippageBps: 50
  }
}

function createClient(previewAmount: bigint): PublicClient {
  return {
    readContract: vi.fn().mockResolvedValue(previewAmount)
  } as unknown as PublicClient
}

describe('createStakingAdapter', () => {
  it('quotes a VeYFI gauge stake with its one-argument deposit call', async () => {
    const adapter = createStakingAdapter({
      chainId: 1,
      source: 'VeYFI',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const quote = await adapter.quote(createRequest('deposit'), createClient(80n))

    expect(quote).toMatchObject({
      activityType: 'stake',
      expectedOut: 80n,
      positionAmount: 80n
    })
    expect(quote.transactions?.map((call) => call.label)).toEqual(['Stake'])
    expect(decodeFunctionData({ abi: VEYFI_STAKING_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'deposit',
      args: [100n]
    })
  })

  it('quotes a tokenized strategy stake for the connected account', async () => {
    const adapter = createStakingAdapter({
      chainId: 1,
      source: 'yBOLD',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const quote = await adapter.quote(createRequest('deposit'), createClient(95n))

    expect(quote.approval).toMatchObject({
      amount: 100n,
      spender: stakingAddress,
      token: vaultToken
    })
    expect(decodeFunctionData({ abi: TOKENIZED_STAKING_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'deposit',
      args: [100n, account]
    })
  })

  it('quotes a legacy rewards stake without a preview call', async () => {
    const client = createClient(0n)
    const adapter = createStakingAdapter({
      chainId: 1,
      source: 'Legacy',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const quote = await adapter.quote(createRequest('deposit'), client)

    expect(quote.expectedOut).toBe(100n)
    expect(client.readContract).not.toHaveBeenCalled()
    expect(decodeFunctionData({ abi: DEFAULT_STAKING_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'stake',
      args: [100n]
    })
  })

  it('quotes tokenized unstaking in vault-token asset units', async () => {
    const adapter = createStakingAdapter({
      chainId: 1,
      source: 'yBOLD',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const quote = await adapter.quote(createRequest('withdraw'), createClient(110n))

    expect(quote).toMatchObject({
      activityType: 'unstake',
      expectedOut: 100n,
      positionAmount: 110n
    })
    expect(quote.approval).toBeUndefined()
    expect(quote.transactions?.map((call) => call.label)).toEqual(['Unstake'])
    expect(decodeFunctionData({ abi: TOKENIZED_STAKING_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'withdraw',
      args: [100n, account, account]
    })
  })
})

describe('createStakingPositionValueReader', () => {
  it('converts tokenized staking shares back to vault-token assets', async () => {
    const readPositionValue = createStakingPositionValueReader({
      source: 'VeYFI',
      stakingAddress
    })

    await expect(readPositionValue(createClient(125n), 100n)).resolves.toBe(125n)
  })

  it('keeps legacy staking rewards balances one-to-one', async () => {
    const client = createClient(0n)
    const readPositionValue = createStakingPositionValueReader({
      source: 'Legacy',
      stakingAddress
    })

    await expect(readPositionValue(client, 100n)).resolves.toBe(100n)
    expect(client.readContract).not.toHaveBeenCalled()
  })
})

describe('createDepositAndStakeAdapter', () => {
  it('composes vault deposit and staking calls with both approvals', async () => {
    const stakingAdapter = createStakingAdapter({
      chainId: 1,
      source: 'VeYFI',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const vaultAdapter = createErc4626Adapter({
      asset: assetToken,
      vaultAddress
    })
    const adapter = createDepositAndStakeAdapter({
      assetToken,
      stakingAdapter,
      stakingToken,
      vaultAdapter,
      vaultToken
    })
    const readContract = vi.fn().mockResolvedValueOnce(80n).mockResolvedValueOnce(70n)
    const quote = await adapter.quote(
      {
        ...createRequest('deposit'),
        autoStake: true,
        selectedToken: assetToken
      },
      { readContract } as unknown as PublicClient
    )
    const [deposit, stake] = quote.transactions ?? []

    expect(quote).toMatchObject({
      activityType: 'deposit and stake',
      expectedOut: 70n,
      positionAmount: 70n
    })
    expect(quote.approvals).toEqual([
      expect.objectContaining({ amount: 100n, token: assetToken }),
      expect.objectContaining({ amount: 80n, token: vaultToken })
    ])
    expect(decodeFunctionData({ abi: ERC4626_ABI, data: deposit!.transaction.data })).toEqual({
      functionName: 'deposit',
      args: [100n, account]
    })
    expect(decodeFunctionData({ abi: VEYFI_STAKING_ABI, data: stake!.transaction.data })).toEqual({
      functionName: 'deposit',
      args: [80n]
    })
  })
})

describe('createUnstakeAndWithdrawAdapter', () => {
  it('builds ordered unstake and V2 withdraw calls from the final asset amount', async () => {
    const stakingAdapter = createStakingAdapter({
      chainId: 1,
      source: 'VeYFI',
      stakingAddress,
      stakingToken,
      vaultToken
    })
    const vaultAdapter = createYearnV2Adapter({
      asset: assetToken,
      positionToken: vaultToken,
      vaultAddress
    })
    const adapter = createUnstakeAndWithdrawAdapter({
      assetToken,
      stakingAdapter,
      vaultAdapter,
      vaultToken
    })
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(2n * 10n ** 18n)
      .mockResolvedValueOnce(6n * 10n ** 18n)
    const request = {
      ...createRequest('withdraw', 10n * 10n ** 18n),
      selectedToken: assetToken
    }
    const quote = await adapter.quote(request, { readContract } as unknown as PublicClient)
    const [unstake, withdraw] = quote.transactions ?? []

    expect(quote).toMatchObject({
      activityType: 'unstake and withdraw',
      amountIn: 6n * 10n ** 18n,
      expectedOut: 10n * 10n ** 18n,
      positionAmount: 6n * 10n ** 18n
    })
    expect(quote.transactions?.map((call) => call.label)).toEqual(['Unstake', 'Withdraw'])
    expect(decodeFunctionData({ abi: VEYFI_STAKING_ABI, data: unstake!.transaction.data })).toEqual({
      functionName: 'withdraw',
      args: [5n * 10n ** 18n, account, account]
    })
    expect(decodeFunctionData({ abi: YEARN_V2_VAULT_ABI, data: withdraw!.transaction.data })).toEqual({
      functionName: 'withdraw',
      args: [5n * 10n ** 18n, account, 100n]
    })
  })
})
