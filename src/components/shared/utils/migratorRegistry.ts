import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { VAULT_MIGRATOR_ABI } from '@shared/contracts/abi/vaultMigrator.abi'
import { YEARN_4626_ROUTER, YEARN_4626_ROUTER_CHAIN_ID } from '@shared/utils/constants'
import type { Abi, Address } from 'viem'
import { mainnet } from 'viem/chains'

export type MigratorConfig = {
  abi: Abi
  functionName: string
  routerAddress?: Address // Only set for fallback, registry uses the key as address
}

export const MIGRATOR_REGISTRY: Record<number, Record<string, MigratorConfig>> = {
  [mainnet.id]: {
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
}

export const getMigratorConfig = (
  chainId: number,
  address: Address,
  vaultVersion?: string
): MigratorConfig | undefined => {
  const config = MIGRATOR_REGISTRY[chainId]?.[address.toLowerCase()]

  if (config) {
    return config
  }

  if (chainId !== YEARN_4626_ROUTER_CHAIN_ID) {
    return undefined
  }

  const isSourceV3 = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3')
  return {
    abi: ERC_4626_ROUTER_ABI,
    functionName: isSourceV3 ? 'migrate' : 'migrateFromV2',
    routerAddress: YEARN_4626_ROUTER
  }
}
