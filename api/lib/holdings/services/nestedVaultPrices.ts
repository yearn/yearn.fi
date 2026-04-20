import type { VaultMetadata } from '../types'
import { getChainPrefix, getPriceAtTimestamp, type THistoricalPriceRequest } from './defillama'
import { getPPS, type PPSTimeline } from './kong'
import { toVaultKey } from './pnlShared'

type TPriceRequestDraft = {
  chainId: number
  address: string
  timestamps: Set<number>
  uncachedTimestamps: Set<number>
  includeUncachedTimestamps: boolean
}

type TVaultIdentifier = {
  chainId: number
  vaultAddress: string
}

function priceMapKey(chainId: number, tokenAddress: string): string {
  return `${getChainPrefix(chainId)}:${tokenAddress.toLowerCase()}`
}

function priceRequestKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`
}

function addPriceRequest(
  drafts: Map<string, TPriceRequestDraft>,
  request: THistoricalPriceRequest,
  includeUncachedTimestamps: boolean
): void {
  const key = priceRequestKey(request.chainId, request.address)
  const draft = drafts.get(key) ?? {
    chainId: request.chainId,
    address: request.address.toLowerCase(),
    timestamps: new Set<number>(),
    uncachedTimestamps: new Set<number>(),
    includeUncachedTimestamps
  }

  request.timestamps.forEach((timestamp) => {
    draft.timestamps.add(timestamp)
  })
  request.uncachedTimestamps?.forEach((timestamp) => {
    draft.timestamps.add(timestamp)
    draft.uncachedTimestamps.add(timestamp)
  })
  draft.includeUncachedTimestamps ||= includeUncachedTimestamps
  drafts.set(key, draft)
}

function materializePriceRequests(drafts: Map<string, TPriceRequestDraft>): THistoricalPriceRequest[] {
  return Array.from(drafts.values()).map((draft) => {
    const uncachedTimestamps = Array.from(draft.uncachedTimestamps).sort((a, b) => a - b)

    return {
      chainId: draft.chainId,
      address: draft.address,
      timestamps: Array.from(draft.timestamps).sort((a, b) => a - b),
      ...(draft.includeUncachedTimestamps || uncachedTimestamps.length > 0 ? { uncachedTimestamps } : {})
    }
  })
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

export function getNestedVaultPpsIdentifiersFromPriceRequests(
  requests: THistoricalPriceRequest[],
  vaultMetadata: Map<string, VaultMetadata>
): TVaultIdentifier[] {
  return mergeVaultIdentifiers(
    requests.flatMap((request) => {
      const nestedVault = vaultMetadata.get(toVaultKey(request.chainId, request.address))

      return nestedVault ? [{ chainId: nestedVault.chainId, vaultAddress: nestedVault.address }] : []
    })
  )
}

export function expandNestedVaultAssetPriceRequests(
  requests: THistoricalPriceRequest[],
  vaultMetadata: Map<string, VaultMetadata>
): THistoricalPriceRequest[] {
  const drafts = new Map<string, TPriceRequestDraft>()

  requests.forEach((request) => {
    const includeUncachedTimestamps = request.uncachedTimestamps !== undefined
    addPriceRequest(drafts, request, includeUncachedTimestamps)

    const nestedVault = vaultMetadata.get(toVaultKey(request.chainId, request.address))
    if (!nestedVault) {
      return
    }

    addPriceRequest(
      drafts,
      {
        chainId: nestedVault.chainId,
        address: nestedVault.token.address,
        timestamps: request.timestamps,
        uncachedTimestamps: request.uncachedTimestamps
      },
      includeUncachedTimestamps
    )
  })

  return materializePriceRequests(drafts)
}

export function deriveNestedVaultAssetPriceData(args: {
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
