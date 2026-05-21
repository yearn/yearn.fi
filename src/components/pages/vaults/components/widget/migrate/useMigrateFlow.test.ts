import {
  buildProtectedMigrateArgs,
  calculateMigrateMinSharesOut,
  encodeProtectedMigrateData,
  migratorSupportsMinSharesOut
} from '@pages/vaults/components/widget/migrate/useMigrateFlow'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import { type Address, decodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'

const VAULT_FROM = '0x0000000000000000000000000000000000000001' as Address
const VAULT_TO = '0x0000000000000000000000000000000000000002' as Address

describe('calculateMigrateMinSharesOut', () => {
  it('applies slippage to a positive destination share preview', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 100_000n,
        slippageBps: 50
      })
    ).toBe(99_500n)
  })

  it('uses integer-safe floor rounding after applying slippage', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 101n,
        slippageBps: 100
      })
    ).toBe(99n)
  })

  it('returns zero for missing or zero previews so submission can be guarded', () => {
    expect(
      calculateMigrateMinSharesOut({
        expectedSharesOut: 0n,
        slippageBps: 50
      })
    ).toBe(0n)
  })
})

describe('migratorSupportsMinSharesOut', () => {
  it('detects router migration functions that can enforce a share floor', () => {
    expect(
      migratorSupportsMinSharesOut({
        abi: ERC_4626_ROUTER_ABI,
        functionName: 'migrate'
      })
    ).toBe(true)
    expect(
      migratorSupportsMinSharesOut({
        abi: ERC_4626_ROUTER_ABI,
        functionName: 'migrateFromV2'
      })
    ).toBe(true)
  })

  it('rejects legacy migrator functions that cannot encode a share floor', () => {
    expect(
      migratorSupportsMinSharesOut({
        abi: VAULT_MIGRATOR_ABI,
        functionName: 'migrateShares'
      })
    ).toBe(false)
  })
})

describe('buildProtectedMigrateArgs', () => {
  it('uses the computed minSharesOut as the fourth migrator argument', () => {
    expect(
      buildProtectedMigrateArgs({
        vaultFrom: VAULT_FROM,
        vaultTo: VAULT_TO,
        balance: 100_000n,
        minSharesOut: 99_500n
      })
    ).toEqual([VAULT_FROM, VAULT_TO, 100_000n, 99_500n])
  })
})

describe('encodeProtectedMigrateData', () => {
  it('encodes the computed minSharesOut in the router migrate call data', () => {
    const data = encodeProtectedMigrateData({
      migratorConfig: {
        abi: ERC_4626_ROUTER_ABI,
        functionName: 'migrate'
      },
      vaultFrom: VAULT_FROM,
      vaultTo: VAULT_TO,
      balance: 100_000n,
      minSharesOut: 99_500n
    })

    expect(
      decodeFunctionData({
        abi: ERC_4626_ROUTER_ABI,
        data
      }).args
    ).toEqual([VAULT_FROM, VAULT_TO, 100_000n, 99_500n])
  })
})
