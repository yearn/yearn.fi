import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultKind,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  getVaultType,
  getVaultVersion,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultsInitialVaultSource, type TVaultsInitialPayload } from '@pages/vaults/utils/vaultsInitialPayload'
import { getNetwork } from '@shared/utils/wagmi'

export type TVaultDirectoryEntry = {
  address: `0x${string}`
  chainId: number
  chainName: string
  href: string
  name: string
  symbol: string
  tokenSymbol: string
  tvl: number
}

const DEFAULT_DIRECTORY_LIMIT = 8

function toDirectoryEntry(vault: TKongVaultInput): TVaultDirectoryEntry {
  const address = getVaultAddress(vault)
  const chainId = getVaultChainID(vault)
  const symbol = getVaultSymbol(vault)
  const tokenSymbol = getVaultToken(vault).symbol

  return {
    address,
    chainId,
    chainName: getNetwork(chainId).name,
    href: `/vaults/${chainId}/${address}`,
    name: getVaultName(vault) || symbol || `${tokenSymbol} Vault`,
    symbol,
    tokenSymbol,
    tvl: getVaultTVL(vault).tvl
  }
}

function isPublicActiveVault(vault: TKongVaultInput): boolean {
  const info = getVaultInfo(vault)
  if (info.isHidden || info.isRetired) {
    return false
  }

  const version = getVaultVersion(vault)
  if (version.startsWith('3') || version.startsWith('~3')) {
    return getVaultKind(vault) === 'Multi Strategy'
  }

  const type = getVaultType(vault)
  return getVaultName(vault).toLowerCase().includes('factory') || ['Automated', 'Automated Yearn Vault'].includes(type)
}

export function buildVaultDirectoryEntries(
  initialVaults?: TVaultsInitialPayload,
  limit = DEFAULT_DIRECTORY_LIMIT
): TVaultDirectoryEntry[] {
  const source = getVaultsInitialVaultSource(initialVaults)
  if (!source || limit <= 0) {
    return []
  }

  const candidates = Object.values(source.vaults)
    .filter(isPublicActiveVault)
    .map(toDirectoryEntry)
    .sort((left, right) => right.tvl - left.tvl || left.name.localeCompare(right.name))
  const chainIds = [...new Set(candidates.map((entry) => entry.chainId))]
  const crossNetworkEntries = chainIds
    .map((chainId) => candidates.find((entry) => entry.chainId === chainId))
    .filter((entry): entry is TVaultDirectoryEntry => Boolean(entry))
  const crossNetworkHrefs = new Set(crossNetworkEntries.map((entry) => entry.href))
  const remainingEntries = candidates.filter((entry) => !crossNetworkHrefs.has(entry.href))

  return [...crossNetworkEntries, ...remainingEntries].slice(0, limit)
}

export function buildVaultDirectoryJsonLd(entries: TVaultDirectoryEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Yearn Vault directory',
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.symbol ? `${entry.name} (${entry.symbol})` : entry.name,
      url: `https://yearn.fi${entry.href}`
    }))
  }
}
