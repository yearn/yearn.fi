import { config } from '../config'
import type { VaultMetadata } from '../types'

interface KongVault {
  address: string
  chainId: number
  symbol: string
  decimals: number
  asset: {
    address: string
    symbol: string
    decimals: number
  }
  staking?: {
    address: string | null
    available: boolean
  }
}

let vaultListCache: Map<string, VaultMetadata> | null = null
let stakingToVaultMap: Map<string, VaultMetadata> | null = null

async function loadVaultList(): Promise<void> {
  if (vaultListCache !== null) return

  const url = `${config.kongBaseUrl}/api/rest/list/vaults?origin=yearn`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`[Kong] Failed to fetch vault list: ${response.status}`)
      vaultListCache = new Map()
      stakingToVaultMap = new Map()
      return
    }

    const vaults = (await response.json()) as KongVault[]
    vaultListCache = new Map()
    stakingToVaultMap = new Map()

    for (const vault of vaults) {
      const metadata: VaultMetadata = {
        address: vault.address,
        chainId: vault.chainId,
        token: {
          address: vault.asset.address,
          symbol: vault.asset.symbol,
          decimals: vault.asset.decimals
        },
        decimals: vault.decimals
      }

      const key = `${vault.chainId}:${vault.address.toLowerCase()}`
      vaultListCache.set(key, metadata)

      // Map staking address to vault metadata (using vault as underlying token)
      if (vault.staking?.address) {
        const stakingKey = `${vault.chainId}:${vault.staking.address.toLowerCase()}`
        const stakingMetadata: VaultMetadata = {
          address: vault.staking.address,
          chainId: vault.chainId,
          token: {
            address: vault.address,
            symbol: vault.symbol,
            decimals: vault.decimals
          },
          decimals: vault.decimals
        }
        stakingToVaultMap.set(stakingKey, stakingMetadata)
      }
    }
  } catch (error) {
    console.error('[Kong] Error fetching vault list:', error)
    vaultListCache = new Map()
    stakingToVaultMap = new Map()
  }
}

export async function fetchVaultMetadata(chainId: number, vaultAddress: string): Promise<VaultMetadata | null> {
  await loadVaultList()

  const key = `${chainId}:${vaultAddress.toLowerCase()}`

  if (vaultListCache!.has(key)) {
    return vaultListCache!.get(key)!
  }

  if (stakingToVaultMap!.has(key)) {
    return stakingToVaultMap!.get(key)!
  }

  return null
}

export async function fetchMultipleVaultsMetadata(
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Promise<Map<string, VaultMetadata>> {
  await loadVaultList()

  const results = new Map<string, VaultMetadata>()

  for (const { chainId, vaultAddress } of vaults) {
    const key = `${chainId}:${vaultAddress.toLowerCase()}`

    if (vaultListCache!.has(key)) {
      results.set(key, vaultListCache!.get(key)!)
      continue
    }

    if (stakingToVaultMap!.has(key)) {
      results.set(key, stakingToVaultMap!.get(key)!)
    }
  }

  return results
}
