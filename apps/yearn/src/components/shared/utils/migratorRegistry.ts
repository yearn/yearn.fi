import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import { ZAP_VE_CRV_ABI } from '@shared/contracts/abi/zapVeCRV.abi'
import type { Abi, Address } from 'viem'
import { ZAP_YEARN_VE_CRV_ADDRESS } from './constants'

export type MigratorConfig = {
  abi: Abi
  functionName: string
  argumentType: 'vault-migrator' | 'erc4626-router' | 'yearn-vecrv-zap'
  routerAddress?: Address // Only set for fallback, registry uses the key as address
}

export const MIGRATOR_REGISTRY: Record<string, MigratorConfig> = {
  // Yearn Vault Migrator (Ethereum)
  '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c': {
    abi: VAULT_MIGRATOR_ABI,
    functionName: 'migrateShares',
    argumentType: 'vault-migrator'
  },
  // Legacy Vault Migrator (Ethereum)
  '0x1824df8d751704fa10fa371d62a37f9b8772ab90': {
    abi: VAULT_MIGRATOR_ABI,
    functionName: 'migrateShares',
    argumentType: 'vault-migrator'
  },
  // Yearn veCRV vault zapper (Ethereum)
  [ZAP_YEARN_VE_CRV_ADDRESS.toLowerCase()]: {
    abi: ZAP_VE_CRV_ABI,
    functionName: 'zap',
    argumentType: 'yearn-vecrv-zap'
  }
}

export const getMigratorConfig = (address: Address): MigratorConfig | undefined => {
  return MIGRATOR_REGISTRY[address.toLowerCase()]
}
