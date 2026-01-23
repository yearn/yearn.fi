import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import type { Abi, Address } from 'viem'

export type MigratorConfig = {
  abi: Abi
  functionName: string
  routerAddress?: Address // Only set for fallback, registry uses the key as address
}

export const MIGRATOR_REGISTRY: Record<string, MigratorConfig> = {
  // Yearn Vault Migrator (Ethereum)
  '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c': {
    abi: VAULT_MIGRATOR_ABI,
    functionName: 'migrateShares'
  },
  // Legacy Vault Migrator (Ethereum)
  '0x1824df8d751704fa10fa371d62a37f9b8772ab90': {
    abi: VAULT_MIGRATOR_ABI,
    functionName: 'migrateShares'
  }
}

export const getMigratorConfig = (address: Address): MigratorConfig | undefined => {
  return MIGRATOR_REGISTRY[address.toLowerCase()]
}
