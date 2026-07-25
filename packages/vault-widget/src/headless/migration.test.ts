import { decodeFunctionData, erc20Abi, toFunctionSelector } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetToken } from '../types'
import {
  createMigrationQuote,
  detectMigrationPermitSupport,
  getMigrationAuthorizationMode,
  isMigrationPermitValid,
  MIGRATION_ROUTER_ABI,
  readMigrationPermitTypedData,
  splitMigrationPermitSignature,
  supportsMigrationPermit,
  YEARN_4626_ROUTER_ADDRESS,
  YEARN_VAULT_MIGRATOR_ADDRESSES
} from './migration'
import { buildTransactionPlan } from './transactionPlan'

const account = '0x1111111111111111111111111111111111111111'
const target = '0x2222222222222222222222222222222222222222'
const token: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'yvOLD'
}
const permitContext = {
  chainId: 1,
  deadline: 1_000n,
  owner: account,
  spender: YEARN_4626_ROUTER_ADDRESS,
  token: token.address,
  value: 12n
} as const
const permitSignature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as const

describe('migration plans', () => {
  it('uses permits only for EOA owners and keeps Safe migrations on approvals', () => {
    expect(getMigrationAuthorizationMode({ permitSupported: true, walletType: 'eoa' })).toBe('permit')
    expect(getMigrationAuthorizationMode({ permitSupported: true, walletType: 'safe' })).toBe('approval')
    expect(getMigrationAuthorizationMode({ permitSupported: false, walletType: 'eoa' })).toBe('approval')
  })

  it('uses approval and the four-argument V2 router migration', () => {
    const quote = createMigrationQuote({
      account,
      chainId: 1,
      fromToken: token,
      migratorAddress: '0x4444444444444444444444444444444444444444',
      shares: 12n,
      sourceVersion: '0.4.6',
      toVault: target
    })
    const plan = buildTransactionPlan({ allowance: 0n, mode: 'migrate', quote })

    expect(quote.approval).toMatchObject({ amount: 12n, spender: YEARN_4626_ROUTER_ADDRESS })
    expect(quote).toMatchObject({
      activityTokenIn: token.address,
      activityTokenOut: target
    })
    expect(quote.transaction.data.slice(0, 10)).toBe(
      toFunctionSelector('migrateFromV2(address,address,uint256,uint256)')
    )
    expect(plan.mode).toBe('migrate')
    const approvalStep = plan.steps.find(({ kind }) => kind === 'approve')
    expect(decodeFunctionData({ abi: erc20Abi, data: approvalStep?.request?.data ?? '0x' })).toEqual({
      functionName: 'approve',
      args: [YEARN_4626_ROUTER_ADDRESS, 12n]
    })
    expect(plan.steps.find(({ id }) => id === 'migrate')?.label).toBe('Migrate')
  })

  it('combines EIP-2612 permit and V3 migration in one router multicall', () => {
    const quote = createMigrationQuote({
      account,
      chainId: 1,
      currentTimestamp: 999n,
      fromToken: token,
      migratorAddress: YEARN_4626_ROUTER_ADDRESS,
      permit: splitMigrationPermitSignature(permitSignature, permitContext),
      shares: 12n,
      sourceVersion: '3.0.4',
      toVault: target
    })
    const decoded = decodeFunctionData({ abi: MIGRATION_ROUTER_ABI, data: quote.transaction.data })

    expect(quote.approval).toBeUndefined()
    expect(quote.adapterId).toBe('migration-permit')
    expect(decoded.functionName).toBe('multicall')
    expect(decoded.args?.[0]).toHaveLength(2)
  })

  it('preserves the registered three-argument vault migrator call', () => {
    const quote = createMigrationQuote({
      account,
      chainId: 1,
      fromToken: token,
      migratorAddress: YEARN_VAULT_MIGRATOR_ADDRESSES[0],
      shares: 12n,
      toVault: target
    })

    expect(quote.transaction.to).toBe(YEARN_VAULT_MIGRATOR_ADDRESSES[0])
    expect(quote.transaction.data.slice(0, 10)).toBe(toFunctionSelector('migrateShares(address,address,uint256)'))
  })

  it('detects permit-capable V3 router migrations and builds the Yearn Vault typed data', async () => {
    expect(
      supportsMigrationPermit({
        migratorAddress: YEARN_4626_ROUTER_ADDRESS,
        sourceVersion: '3.0.4'
      })
    ).toBe(true)
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(`0x${'11'.repeat(32)}`)
      .mockRejectedValueOnce(new Error('PERMIT_TYPEHASH is not exposed'))
      .mockResolvedValueOnce(7n)
      .mockResolvedValueOnce('3.0.4')
      .mockResolvedValueOnce('3.0.4')
    const publicClient = { readContract } as never

    await expect(detectMigrationPermitSupport(publicClient, token.address)).resolves.toBe(true)
    await expect(
      readMigrationPermitTypedData({
        account,
        chainId: 1,
        deadline: 1_000n,
        publicClient,
        spender: YEARN_4626_ROUTER_ADDRESS,
        tokenAddress: token.address,
        value: 12n
      })
    ).resolves.toMatchObject({
      domain: {
        chainId: 1,
        name: 'Yearn Vault',
        verifyingContract: token.address,
        version: '3.0.4'
      },
      message: {
        deadline: 1_000n,
        nonce: 7n,
        owner: account,
        spender: YEARN_4626_ROUTER_ADDRESS,
        value: 12n
      },
      primaryType: 'Permit'
    })
  })

  it('splits an EIP-2612 signature into router arguments', () => {
    expect(splitMigrationPermitSignature(permitSignature, permitContext)).toEqual({
      ...permitContext,
      r: `0x${'11'.repeat(32)}`,
      s: `0x${'22'.repeat(32)}`,
      v: 27
    })
  })

  it('normalizes compact recovery IDs and rejects malformed signatures', () => {
    const compactSignature = `0x${'11'.repeat(32)}${'22'.repeat(32)}00` as const

    expect(splitMigrationPermitSignature(compactSignature, permitContext).v).toBe(27)
    expect(() => splitMigrationPermitSignature('0x1234', permitContext)).toThrow('65 bytes')
    expect(() => splitMigrationPermitSignature(`0x${'11'.repeat(32)}${'22'.repeat(32)}02`, permitContext)).toThrow(
      'invalid recovery ID'
    )
  })

  it('binds permits to their owner, chain, token, spender, value, and deadline', () => {
    const permit = splitMigrationPermitSignature(permitSignature, permitContext)
    const base = {
      account,
      chainId: 1,
      currentTimestamp: 999n,
      permit,
      spender: YEARN_4626_ROUTER_ADDRESS,
      token: token.address,
      value: 12n
    } as const

    expect(isMigrationPermitValid(base)).toBe(true)
    expect(isMigrationPermitValid({ ...base, account: target })).toBe(false)
    expect(isMigrationPermitValid({ ...base, chainId: 10 })).toBe(false)
    expect(isMigrationPermitValid({ ...base, token: target })).toBe(false)
    expect(isMigrationPermitValid({ ...base, spender: target })).toBe(false)
    expect(isMigrationPermitValid({ ...base, value: 13n })).toBe(false)
    expect(isMigrationPermitValid({ ...base, currentTimestamp: 1_000n })).toBe(false)
  })

  it('rejects stale or context-mismatched permits before creating calldata', () => {
    const permit = splitMigrationPermitSignature(permitSignature, permitContext)
    const params = {
      account,
      chainId: 1,
      currentTimestamp: 1_000n,
      fromToken: token,
      migratorAddress: YEARN_4626_ROUTER_ADDRESS,
      permit,
      shares: 12n,
      sourceVersion: '3.0.4',
      toVault: target
    } as const

    expect(() => createMigrationQuote(params)).toThrow('expired or does not match')
    expect(() => createMigrationQuote({ ...params, currentTimestamp: undefined })).toThrow('current chain timestamp')
    expect(() => createMigrationQuote({ ...params, currentTimestamp: 999n, shares: 13n })).toThrow(
      'expired or does not match'
    )
  })

  it('does not sign with an assumed nonce when the nonce read fails', async () => {
    const publicClient = {
      readContract: vi
        .fn()
        .mockRejectedValueOnce(new Error('RPC unavailable'))
        .mockResolvedValueOnce('3.0.4')
        .mockResolvedValueOnce('3.0.4')
    } as never

    await expect(
      readMigrationPermitTypedData({
        account,
        chainId: 1,
        deadline: 1_000n,
        publicClient,
        spender: YEARN_4626_ROUTER_ADDRESS,
        tokenAddress: token.address,
        value: 12n
      })
    ).rejects.toThrow('permit nonce')
  })
})
