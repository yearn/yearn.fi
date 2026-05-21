import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import { base, mainnet } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { YEARN_4626_ROUTER } from './constants'
import { getMigratorConfig } from './migratorRegistry'

const ETHEREUM_MIGRATOR = '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c'
const UNKNOWN_ROUTER = '0x0000000000000000000000000000000000000001'

describe('getMigratorConfig', () => {
  it('resolves registered Ethereum migrators by chain and address', () => {
    expect(getMigratorConfig(mainnet.id, ETHEREUM_MIGRATOR)).toEqual({
      abi: VAULT_MIGRATOR_ABI,
      functionName: 'migrateShares'
    })
  })

  it('does not resolve a registered Ethereum address on another chain', () => {
    expect(getMigratorConfig(base.id, ETHEREUM_MIGRATOR)).toBeUndefined()
  })

  it('allows the ERC-4626 router fallback only on Ethereum', () => {
    expect(getMigratorConfig(mainnet.id, UNKNOWN_ROUTER, '3.0')).toEqual({
      abi: ERC_4626_ROUTER_ABI,
      functionName: 'migrate',
      routerAddress: YEARN_4626_ROUTER
    })

    expect(getMigratorConfig(base.id, UNKNOWN_ROUTER, '3.0')).toBeUndefined()
  })
})
