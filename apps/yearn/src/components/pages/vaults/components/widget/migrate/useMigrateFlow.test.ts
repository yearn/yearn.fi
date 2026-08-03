import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import { ZAP_VE_CRV_ABI } from '@shared/contracts/abi/zapVeCRV.abi'
import type { MigratorConfig } from '@shared/utils/migratorRegistry'
import { type Address, encodeFunctionData, toFunctionSelector } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  getErc4626RouterMigrateArgs,
  getMigrateArgs,
  getVaultMigratorArgs,
  getYearnVeCrvZapArgs
} from './useMigrateFlow'

const FROM_VAULT = '0x1111111111111111111111111111111111111111' as Address
const TO_VAULT = '0x2222222222222222222222222222222222222222' as Address
const RECIPIENT = '0x3333333333333333333333333333333333333333' as Address
const SHARE_BALANCE = 10n ** 18n
const VAULT_MIGRATOR_CONFIG = {
  abi: VAULT_MIGRATOR_ABI,
  functionName: 'migrateShares',
  argumentType: 'vault-migrator'
} as const satisfies MigratorConfig
const ERC_4626_MIGRATE_CONFIG = {
  abi: ERC_4626_ROUTER_ABI,
  functionName: 'migrate',
  argumentType: 'erc4626-router'
} as const satisfies MigratorConfig
const ERC_4626_MIGRATE_FROM_V2_CONFIG = {
  abi: ERC_4626_ROUTER_ABI,
  functionName: 'migrateFromV2',
  argumentType: 'erc4626-router'
} as const satisfies MigratorConfig
const YEARN_VE_CRV_ZAP_CONFIG = {
  abi: ZAP_VE_CRV_ABI,
  functionName: 'zap',
  argumentType: 'yearn-vecrv-zap'
} as const satisfies MigratorConfig

describe('getMigrateArgs', () => {
  it('keeps vault migrator calls on the 3-input migrateShares ABI', () => {
    expect(getMigrateArgs(VAULT_MIGRATOR_CONFIG, FROM_VAULT, TO_VAULT, SHARE_BALANCE, RECIPIENT)).toEqual([
      FROM_VAULT,
      TO_VAULT,
      SHARE_BALANCE
    ])

    const data = encodeFunctionData({
      abi: VAULT_MIGRATOR_ABI,
      functionName: 'migrateShares',
      args: getVaultMigratorArgs(FROM_VAULT, TO_VAULT, SHARE_BALANCE)
    })

    expect(data.slice(0, 10)).toBe(toFunctionSelector('migrateShares(address,address,uint256)'))
  })

  it.each([
    {
      config: ERC_4626_MIGRATE_CONFIG,
      functionName: 'migrate',
      expectedSelector: toFunctionSelector('migrate(address,address,uint256,uint256)'),
      rejectedSelector: toFunctionSelector('migrate(address,address,uint256)')
    },
    {
      config: ERC_4626_MIGRATE_FROM_V2_CONFIG,
      functionName: 'migrateFromV2',
      expectedSelector: toFunctionSelector('migrateFromV2(address,address,uint256,uint256)'),
      rejectedSelector: toFunctionSelector('migrateFromV2(address,address,uint256)')
    }
  ] as const)('encodes $functionName with the 4-input overload', ({
    config,
    functionName,
    expectedSelector,
    rejectedSelector
  }) => {
    expect(getMigrateArgs(config, FROM_VAULT, TO_VAULT, SHARE_BALANCE, RECIPIENT)).toEqual([
      FROM_VAULT,
      TO_VAULT,
      SHARE_BALANCE,
      0n
    ])

    const data = encodeFunctionData({
      abi: ERC_4626_ROUTER_ABI,
      functionName,
      args: getErc4626RouterMigrateArgs(FROM_VAULT, TO_VAULT, SHARE_BALANCE)
    })
    const selector = data.slice(0, 10)

    expect(selector).toBe(expectedSelector)
    expect(selector).not.toBe(rejectedSelector)
  })

  it('encodes the Yearn veCRV zapper with amount, minOut, and recipient', () => {
    expect(getMigrateArgs(YEARN_VE_CRV_ZAP_CONFIG, FROM_VAULT, TO_VAULT, SHARE_BALANCE, RECIPIENT)).toEqual([
      FROM_VAULT,
      TO_VAULT,
      SHARE_BALANCE,
      0n,
      RECIPIENT
    ])

    const data = encodeFunctionData({
      abi: ZAP_VE_CRV_ABI,
      functionName: 'zap',
      args: getYearnVeCrvZapArgs(FROM_VAULT, TO_VAULT, SHARE_BALANCE, RECIPIENT)
    })

    expect(data.slice(0, 10)).toBe(toFunctionSelector('zap(address,address,uint256,uint256,address)'))
  })
})
