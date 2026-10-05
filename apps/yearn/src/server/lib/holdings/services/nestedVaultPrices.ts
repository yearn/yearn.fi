import type { VaultMetadata } from '../types'
import { getPPS, type PPSTimeline } from './kong'
import { toVaultKey } from './pnlShared'
import { getChainPrefix, getPriceAtTimestamp, type THistoricalPriceRequest } from './prices'

type TPriceRequestDraft = {
  chainId: number
  address: string
  timestamps: Set<number>
}

type TVaultIdentifier = {
  chainId: number
  vaultAddress: string
}

type TFetchVaultMetadata = (
  vaults: TVaultIdentifier[],
  options: { skipSnapshotFallback: boolean }
) => Promise<Map<string, VaultMetadata>>

const DEFAULT_MAX_NESTED_VAULT_DEPTH = 4
const UNRESOLVED_NESTED_VAULT_METADATA_KEYS = Symbol('unresolvedNestedVaultMetadataKeys')

type TNestedVaultMetadataResult = Map<string, VaultMetadata> & {
  [UNRESOLVED_NESTED_VAULT_METADATA_KEYS]?: ReadonlySet<string>
}

type TNestedVaultAssetPath = {
  terminalAsset: VaultMetadata['token'] | null
  vaults: VaultMetadata[]
  missingMetadata: boolean
}

export type TNestedVaultValuation = {
  terminalAsset: VaultMetadata['token'] | null
  pricePerShare: number | null
  underlyingToTerminalRate: number | null
  missingMetadata: boolean
}

function getUnresolvedNestedVaultMetadataKeys(vaultMetadata: Map<string, VaultMetadata>): ReadonlySet<string> {
  return (vaultMetadata as TNestedVaultMetadataResult)[UNRESOLVED_NESTED_VAULT_METADATA_KEYS] ?? new Set()
}

function markUnresolvedNestedVaultMetadata(
  vaultMetadata: Map<string, VaultMetadata>,
  unresolvedVaultKeys: ReadonlySet<string>
): Map<string, VaultMetadata> {
  Object.defineProperty(vaultMetadata, UNRESOLVED_NESTED_VAULT_METADATA_KEYS, {
    value: unresolvedVaultKeys,
    enumerable: false,
    configurable: true
  })
  return vaultMetadata
}

function resolveNestedVaultAssetPath(args: {
  chainId: number
  vaultAddress: string
  vaultMetadata: Map<string, VaultMetadata>
  maxDepth: number
  depth: number
  visitedVaultKeys: Set<string>
}): TNestedVaultAssetPath {
  const vaultKey = toVaultKey(args.chainId, args.vaultAddress)
  if (args.visitedVaultKeys.has(vaultKey)) {
    return { terminalAsset: null, vaults: [], missingMetadata: true }
  }

  const vault = args.vaultMetadata.get(vaultKey)
  if (!vault) {
    return { terminalAsset: null, vaults: [], missingMetadata: true }
  }

  const nestedVaultKey = toVaultKey(vault.chainId, vault.token.address)
  const nestedVault = args.vaultMetadata.get(nestedVaultKey)
  if (!nestedVault) {
    const missingMetadata = getUnresolvedNestedVaultMetadataKeys(args.vaultMetadata).has(nestedVaultKey)
    return {
      terminalAsset: missingMetadata ? null : vault.token,
      vaults: [vault],
      missingMetadata
    }
  }

  if (args.depth >= args.maxDepth) {
    return { terminalAsset: null, vaults: [vault], missingMetadata: true }
  }

  const nestedPath = resolveNestedVaultAssetPath({
    chainId: nestedVault.chainId,
    vaultAddress: nestedVault.address,
    vaultMetadata: args.vaultMetadata,
    maxDepth: args.maxDepth,
    depth: args.depth + 1,
    visitedVaultKeys: new Set([...args.visitedVaultKeys, vaultKey])
  })

  return {
    terminalAsset: nestedPath.terminalAsset,
    vaults: [vault, ...nestedPath.vaults],
    missingMetadata: nestedPath.missingMetadata
  }
}

function getCompoundedPps(
  vaults: VaultMetadata[],
  ppsData: Map<string, PPSTimeline>,
  timestamp: number
): number | null {
  const pricesPerShare = vaults.map((vault) => {
    const ppsTimeline = ppsData.get(toVaultKey(vault.chainId, vault.address))
    return ppsTimeline ? getPPS(ppsTimeline, timestamp) : null
  })

  return pricesPerShare.every(
    (pricePerShare): pricePerShare is number =>
      pricePerShare !== null && Number.isFinite(pricePerShare) && pricePerShare > 0
  )
    ? pricesPerShare.reduce((product, pricePerShare) => product * pricePerShare, 1)
    : null
}

function getNestedVaultAssetPath(args: {
  chainId: number
  vaultAddress: string
  vaultMetadata: Map<string, VaultMetadata>
  maxDepth?: number
}): TNestedVaultAssetPath {
  return resolveNestedVaultAssetPath({
    chainId: args.chainId,
    vaultAddress: args.vaultAddress,
    vaultMetadata: args.vaultMetadata,
    maxDepth: args.maxDepth ?? DEFAULT_MAX_NESTED_VAULT_DEPTH,
    depth: 0,
    visitedVaultKeys: new Set()
  })
}

export function resolveNestedVaultTerminalAsset(args: {
  chainId: number
  vaultAddress: string
  vaultMetadata: Map<string, VaultMetadata>
  maxDepth?: number
}): VaultMetadata['token'] | null {
  return getNestedVaultAssetPath(args).terminalAsset
}

export function resolveNestedVaultValuation(args: {
  chainId: number
  vaultAddress: string
  vaultMetadata: Map<string, VaultMetadata>
  ppsData: Map<string, PPSTimeline>
  timestamp: number
  maxDepth?: number
}): TNestedVaultValuation {
  const path = getNestedVaultAssetPath({
    chainId: args.chainId,
    vaultAddress: args.vaultAddress,
    vaultMetadata: args.vaultMetadata,
    maxDepth: args.maxDepth
  })

  if (path.missingMetadata) {
    return {
      terminalAsset: null,
      pricePerShare: null,
      underlyingToTerminalRate: null,
      missingMetadata: true
    }
  }

  return {
    terminalAsset: path.terminalAsset,
    pricePerShare: getCompoundedPps(path.vaults, args.ppsData, args.timestamp),
    underlyingToTerminalRate: getCompoundedPps(path.vaults.slice(1), args.ppsData, args.timestamp),
    missingMetadata: false
  }
}

function priceMapKey(chainId: number, tokenAddress: string): string {
  return `${getChainPrefix(chainId)}:${tokenAddress.toLowerCase()}`
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
  maxDepth = DEFAULT_MAX_NESTED_VAULT_DEPTH,
  fetchVaultMetadata?: TFetchVaultMetadata
): Promise<Map<string, VaultMetadata>> {
  if (maxDepth < 0) {
    return vaultMetadata
  }

  const missingAssetVaultIdentifiers = getAssetVaultMetadataLookupIdentifiers(vaultMetadata).filter(
    (identifier) => !vaultMetadata.has(toVaultKey(identifier.chainId, identifier.vaultAddress))
  )

  if (missingAssetVaultIdentifiers.length === 0) {
    return vaultMetadata
  }

  const {
    fetchMultipleVaultsMetadata: defaultFetchVaultMetadata,
    getVaultMetadataFetchFailedVaults,
    markVaultMetadataFetchFailures
  } = await import('./vaults')
  const assetVaultMetadata = await (fetchVaultMetadata ?? defaultFetchVaultMetadata)(missingAssetVaultIdentifiers, {
    skipSnapshotFallback: true
  })
  const assetMetadataFailedVaults = getVaultMetadataFetchFailedVaults(assetVaultMetadata)
  const failedVaults = getVaultMetadataFetchFailedVaults(vaultMetadata) + assetMetadataFailedVaults
  const newEntries = Array.from(assetVaultMetadata.entries()).filter(([key]) => !vaultMetadata.has(key))
  const requestedVaultKeys = new Set(
    missingAssetVaultIdentifiers.map((identifier) => toVaultKey(identifier.chainId, identifier.vaultAddress))
  )
  const unresolvedVaultKeys = new Set([
    ...Array.from(getUnresolvedNestedVaultMetadataKeys(vaultMetadata)).filter((key) => !requestedVaultKeys.has(key)),
    ...(assetMetadataFailedVaults > 0
      ? Array.from(requestedVaultKeys).filter((key) => !assetVaultMetadata.has(key))
      : [])
  ])
  const resolvedMetadata = markUnresolvedNestedVaultMetadata(
    markVaultMetadataFetchFailures(new Map([...vaultMetadata, ...newEntries]), failedVaults),
    unresolvedVaultKeys
  )

  if (newEntries.length === 0 || maxDepth === 0) {
    return resolvedMetadata
  }

  return resolveNestedVaultAssetMetadata(
    resolvedMetadata,
    maxDepth - 1,
    fetchVaultMetadata ?? defaultFetchVaultMetadata
  )
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
  underlyingPriceLookup: 'prior' | 'exact'
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
      const underlyingTokenPrice =
        args.underlyingPriceLookup === 'exact'
          ? (underlyingPriceMap.get(timestamp) ?? 0)
          : getPriceAtTimestamp(underlyingPriceMap, timestamp)
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
  underlyingPriceLookup?: 'prior' | 'exact'
}): Map<string, Map<number, number>> {
  const maxDepth = args.maxDepth ?? DEFAULT_MAX_NESTED_VAULT_DEPTH

  return Array.from({ length: Math.max(1, maxDepth) }).reduce<Map<string, Map<number, number>>>(
    (priceData) =>
      deriveNestedVaultAssetPriceDataOnce({
        priceData,
        priceRequests: args.priceRequests,
        vaultMetadata: args.vaultMetadata,
        ppsData: args.ppsData,
        underlyingPriceLookup: args.underlyingPriceLookup ?? 'prior'
      }),
    args.priceData
  )
}
