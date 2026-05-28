import type { VaultMetadata } from '../types'
import { getChainPrefix, type THistoricalPriceRequest } from './defillama'
import { getPPS, type PPSTimeline } from './kong'
import { toVaultKey } from './pnlShared'

type TPriceRequestDraft = {
  chainId: number
  address: string
  timestamps: Set<number>
}

type TVaultIdentifier = {
  chainId: number
  vaultAddress: string
}

const DEFAULT_MAX_NESTED_VAULT_DEPTH = 4

function priceMapKey(chainId: number, tokenAddress: string): string {
  return `${getChainPrefix(chainId)}:${tokenAddress.toLowerCase()}`
}

function getPriceAtTimestamp(priceMap: Map<number, number>, targetTimestamp: number): number {
  if (priceMap.has(targetTimestamp)) {
    return priceMap.get(targetTimestamp)!
  }

  const closestPriorTimestamp = Array.from(priceMap.keys())
    .sort((left, right) => left - right)
    .filter((timestamp) => timestamp <= targetTimestamp)
    .pop()

  return closestPriorTimestamp === undefined ? 0 : priceMap.get(closestPriorTimestamp) || 0
}

function priceRequestKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`
}

function addPriceRequest(drafts: Map<string, TPriceRequestDraft>, request: THistoricalPriceRequest): void {
  const key = priceRequestKey(request.chainId, request.address)
  const draft = drafts.get(key) ?? {
    chainId: request.chainId,
    address: request.address.toLowerCase(),
    timestamps: new Set<number>()
  }

  request.timestamps.forEach((timestamp) => {
    draft.timestamps.add(timestamp)
  })
  drafts.set(key, draft)
}

function materializePriceRequests(drafts: Map<string, TPriceRequestDraft>): THistoricalPriceRequest[] {
  return Array.from(drafts.values()).map((draft) => ({
    chainId: draft.chainId,
    address: draft.address,
    timestamps: Array.from(draft.timestamps).sort((a, b) => a - b)
  }))
}

export function mergeVaultIdentifiers(vaults: TVaultIdentifier[]): TVaultIdentifier[] {
  return Array.from(
    vaults
      .reduce<Map<string, TVaultIdentifier>>((merged, vault) => {
        merged.set(toVaultKey(vault.chainId, vault.vaultAddress), {
          chainId: vault.chainId,
          vaultAddress: vault.vaultAddress.toLowerCase()
        })
        return merged
      }, new Map())
      .values()
  )
}

export function getAssetVaultMetadataLookupIdentifiers(vaultMetadata: Map<string, VaultMetadata>): TVaultIdentifier[] {
  return mergeVaultIdentifiers(
    Array.from(vaultMetadata.values()).map((metadata) => ({
      chainId: metadata.chainId,
      vaultAddress: metadata.token.address
    }))
  )
}

export async function resolveNestedVaultAssetMetadata(
  vaultMetadata: Map<string, VaultMetadata>,
  maxDepth = DEFAULT_MAX_NESTED_VAULT_DEPTH
): Promise<Map<string, VaultMetadata>> {
  if (maxDepth <= 0) {
    return vaultMetadata
  }

  const missingAssetVaultIdentifiers = getAssetVaultMetadataLookupIdentifiers(vaultMetadata).filter(
    (identifier) => !vaultMetadata.has(toVaultKey(identifier.chainId, identifier.vaultAddress))
  )

  if (missingAssetVaultIdentifiers.length === 0) {
    return vaultMetadata
  }

  const { fetchMultipleVaultsMetadata } = await import('./vaults')
  const assetVaultMetadata = await fetchMultipleVaultsMetadata(missingAssetVaultIdentifiers, {
    skipSnapshotFallback: true
  })
  const newEntries = Array.from(assetVaultMetadata.entries()).filter(([key]) => !vaultMetadata.has(key))

  if (newEntries.length === 0) {
    return vaultMetadata
  }

  return resolveNestedVaultAssetMetadata(new Map([...vaultMetadata, ...newEntries]), maxDepth - 1)
}

function getNestedVaultPpsIdentifiersForRequest(
  request: THistoricalPriceRequest,
  vaultMetadata: Map<string, VaultMetadata>,
  maxDepth: number
): TVaultIdentifier[] {
  if (maxDepth <= 0) {
    return []
  }

  const nestedVault = vaultMetadata.get(toVaultKey(request.chainId, request.address))

  if (!nestedVault) {
    return []
  }

  return [
    { chainId: nestedVault.chainId, vaultAddress: nestedVault.address },
    ...getNestedVaultPpsIdentifiersForRequest(
      {
        chainId: nestedVault.chainId,
        address: nestedVault.token.address,
        timestamps: request.timestamps
      },
      vaultMetadata,
      maxDepth - 1
    )
  ]
}

export function getNestedVaultPpsIdentifiersFromPriceRequests(
  requests: THistoricalPriceRequest[],
  vaultMetadata: Map<string, VaultMetadata>,
  maxDepth = DEFAULT_MAX_NESTED_VAULT_DEPTH
): TVaultIdentifier[] {
  return mergeVaultIdentifiers(
    requests.flatMap((request) => getNestedVaultPpsIdentifiersForRequest(request, vaultMetadata, maxDepth))
  )
}

function addNestedVaultAssetPriceRequests(
  drafts: Map<string, TPriceRequestDraft>,
  request: THistoricalPriceRequest,
  vaultMetadata: Map<string, VaultMetadata>,
  maxDepth: number
): void {
  if (maxDepth <= 0) {
    return
  }

  const nestedVault = vaultMetadata.get(toVaultKey(request.chainId, request.address))
  if (!nestedVault) {
    return
  }

  const nestedAssetRequest = {
    chainId: nestedVault.chainId,
    address: nestedVault.token.address,
    timestamps: request.timestamps
  }

  addPriceRequest(drafts, nestedAssetRequest)
  addNestedVaultAssetPriceRequests(drafts, nestedAssetRequest, vaultMetadata, maxDepth - 1)
}

export function expandNestedVaultAssetPriceRequests(
  requests: THistoricalPriceRequest[],
  vaultMetadata: Map<string, VaultMetadata>,
  maxDepth = DEFAULT_MAX_NESTED_VAULT_DEPTH
): THistoricalPriceRequest[] {
  const drafts = new Map<string, TPriceRequestDraft>()

  requests.forEach((request) => {
    addPriceRequest(drafts, request)
    addNestedVaultAssetPriceRequests(drafts, request, vaultMetadata, maxDepth)
  })

  return materializePriceRequests(drafts)
}

function deriveNestedVaultAssetPriceDataOnce(args: {
  priceData: Map<string, Map<number, number>>
  priceRequests: THistoricalPriceRequest[]
  vaultMetadata: Map<string, VaultMetadata>
  ppsData: Map<string, PPSTimeline>
}): Map<string, Map<number, number>> {
  const result = new Map(Array.from(args.priceData.entries()).map(([key, priceMap]) => [key, new Map(priceMap)]))

  args.priceRequests.forEach((request) => {
    const nestedVault = args.vaultMetadata.get(toVaultKey(request.chainId, request.address))
    if (!nestedVault) {
      return
    }

    const ppsMap = args.ppsData.get(toVaultKey(nestedVault.chainId, nestedVault.address))
    const underlyingPriceMap = result.get(priceMapKey(nestedVault.chainId, nestedVault.token.address))
    if (!ppsMap || !underlyingPriceMap) {
      return
    }

    const targetKey = priceMapKey(request.chainId, request.address)
    const targetPriceMap = result.get(targetKey) ?? new Map<number, number>()

    request.timestamps.forEach((timestamp) => {
      if ((targetPriceMap.get(timestamp) ?? 0) > 0) {
        return
      }

      const pricePerShare = getPPS(ppsMap, timestamp)
      const underlyingTokenPrice = getPriceAtTimestamp(underlyingPriceMap, timestamp)
      if (pricePerShare === null || pricePerShare <= 0 || underlyingTokenPrice <= 0) {
        return
      }

      targetPriceMap.set(timestamp, pricePerShare * underlyingTokenPrice)
    })

    result.set(targetKey, targetPriceMap)
  })

  return result
}

export function deriveNestedVaultAssetPriceData(args: {
  priceData: Map<string, Map<number, number>>
  priceRequests: THistoricalPriceRequest[]
  vaultMetadata: Map<string, VaultMetadata>
  ppsData: Map<string, PPSTimeline>
  maxDepth?: number
}): Map<string, Map<number, number>> {
  const maxDepth = args.maxDepth ?? DEFAULT_MAX_NESTED_VAULT_DEPTH

  return Array.from({ length: Math.max(1, maxDepth) }).reduce<Map<string, Map<number, number>>>(
    (priceData) =>
      deriveNestedVaultAssetPriceDataOnce({
        priceData,
        priceRequests: args.priceRequests,
        vaultMetadata: args.vaultMetadata,
        ppsData: args.ppsData
      }),
    args.priceData
  )
}
