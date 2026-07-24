import { decodeFunctionData, erc4626Abi, type PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetRequest, VaultWidgetToken } from '../types'
import {
  createCancelCooldownTransaction,
  createLockedVaultAdapter,
  createLockedVaultPositionValueReader,
  createStartCooldownTransaction,
  resolveVaultWidgetCooldownState,
  VaultWidgetCooldownRequiredError,
  YVUSD_LOCKED_VAULT_ABI,
  YVUSD_LOCKED_ZAP_ABI
} from './lockedVault'

const account = '0x1111111111111111111111111111111111111111'
const asset: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 6,
  symbol: 'USDC'
}
const lockedVault = '0x3333333333333333333333333333333333333333'
const unlockedVault = '0x4444444444444444444444444444444444444444'
const zapAddress = '0x5555555555555555555555555555555555555555'

function createRequest(mode: 'deposit' | 'withdraw', amount: bigint): VaultWidgetRequest {
  return {
    account,
    amount,
    chainId: 1,
    maxLossBps: 100,
    mode,
    positionBalance: 1_000n,
    selectedToken: asset,
    signal: new AbortController().signal,
    slippageBps: 50
  }
}

describe('locked vault cooldown state', () => {
  it.each([
    { availableWithdrawLimit: 0n, now: 50, status: [0n, 0n, 0n] as const, expected: 'none' },
    { availableWithdrawLimit: 0n, now: 50, status: [100n, 200n, 10n] as const, expected: 'cooling' },
    { availableWithdrawLimit: 10n, now: 150, status: [100n, 200n, 10n] as const, expected: 'ready' },
    { availableWithdrawLimit: 0n, now: 201, status: [100n, 200n, 10n] as const, expected: 'expired' }
  ])('resolves $expected from chain time and limits', ({ availableWithdrawLimit, expected, now, status }) => {
    expect(
      resolveVaultWidgetCooldownState({
        availableWithdrawLimit,
        cooldownDuration: 100n,
        maxRedeem: 10n,
        now,
        status,
        withdrawalWindow: 50n
      }).state
    ).toBe(expected)
  })

  it('encodes start and cancel cooldown calls', () => {
    const start = createStartCooldownTransaction({ chainId: 1, shares: 12n, vaultAddress: lockedVault })
    const cancel = createCancelCooldownTransaction({ chainId: 1, vaultAddress: lockedVault })

    expect(decodeFunctionData({ abi: YVUSD_LOCKED_VAULT_ABI, data: start.data })).toEqual({
      functionName: 'startCooldown',
      args: [12n]
    })
    expect(decodeFunctionData({ abi: YVUSD_LOCKED_VAULT_ABI, data: cancel.data })).toEqual({
      functionName: 'cancelCooldown'
    })
  })
})

describe('locked vault adapter', () => {
  const adapter = createLockedVaultAdapter({
    asset,
    lockedVaultAddress: lockedVault,
    unlockedVaultAddress: unlockedVault,
    zapAddress
  })

  it('quotes a zap deposit with an exact approval target', async () => {
    const client = { readContract: vi.fn().mockResolvedValue(90n) } as unknown as PublicClient
    const quote = await adapter.quote(createRequest('deposit', 100n), client)

    expect(quote.approval).toEqual({ amount: 100n, spender: zapAddress, token: asset })
    expect(quote.expectedOut).toBe(90n)
    expect(decodeFunctionData({ abi: YVUSD_LOCKED_ZAP_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'zapIn',
      args: [100n, account]
    })
  })

  it('quotes the locked-to-unlocked-to-underlying withdrawal sequence', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(1_000n)
      .mockResolvedValueOnce(500n)
      .mockResolvedValueOnce([0n, 0n, 0n])
      .mockResolvedValueOnce(500n)
      .mockResolvedValueOnce(300n)
      .mockResolvedValueOnce(40n)
      .mockResolvedValueOnce(50n)
    const client = {
      readContract,
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1n })
    } as unknown as PublicClient

    const quote = await adapter.quote(createRequest('withdraw', 25n), client)

    expect(quote.positionAmount).toBe(50n)
    expect(quote.transactions).toHaveLength(2)
    expect(decodeFunctionData({ abi: erc4626Abi, data: quote.transactions?.[0]?.transaction.data ?? '0x' })).toEqual({
      functionName: 'withdraw',
      args: [40n, account, account]
    })
    expect(decodeFunctionData({ abi: erc4626Abi, data: quote.transactions?.[1]?.transaction.data ?? '0x' })).toEqual({
      functionName: 'withdraw',
      args: [25n, account, account]
    })
  })

  it('blocks withdrawal when the requested assets are outside the open window limit', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(1_000n)
      .mockResolvedValueOnce(500n)
      .mockResolvedValueOnce([100n, 200n, 80n])
      .mockResolvedValueOnce(10n)
      .mockResolvedValueOnce(80n)
      .mockResolvedValueOnce(40n)
      .mockResolvedValueOnce(50n)
    const client = {
      readContract,
      getBlock: vi.fn().mockResolvedValue({ timestamp: 50n })
    } as unknown as PublicClient

    await expect(adapter.quote(createRequest('withdraw', 25n), client)).rejects.toBeInstanceOf(
      VaultWidgetCooldownRequiredError
    )
  })

  it('values locked shares through both ERC-4626 vaults', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(80n).mockResolvedValueOnce(75n)
    const reader = createLockedVaultPositionValueReader({
      lockedVaultAddress: lockedVault,
      unlockedVaultAddress: unlockedVault
    })

    await expect(reader({ readContract } as unknown as PublicClient, 100n)).resolves.toBe(75n)
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ address: lockedVault, functionName: 'previewRedeem', args: [100n] })
    )
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: unlockedVault, functionName: 'previewRedeem', args: [80n] })
    )
  })
})
