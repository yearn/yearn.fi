import { config } from '../config'
import type { VaultMetadata } from '../types'
import { debugError, debugLog } from './debug'
import { getUnderlyingVault, isStakingVault } from './staking'

interface KongVault {
  address: string
  apiVersion?: string
  chainId: number
  symbol: string
  decimals: number
  v3?: boolean
  category?: string | null
  isHidden?: boolean
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

interface KongVaultSnapshot {
  address: string
  apiVersion?: string
  chainId: number
  symbol?: string
  decimals?: number
  v3?: boolean
  meta?: {
    category?: string | null
    isHidden?: boolean
  } | null
  asset?: {
    address: string
    symbol: string
    decimals: number
  }
  staking?: {
    address?: string | null
    available?: boolean
  } | null
}

type TVaultListState = {
  vaultListCache: Map<string, VaultMetadata> | null
  stakingToVaultMap: Map<string, VaultMetadata> | null
  hasLoadedGlobalVaultList: boolean
  loadPromise: Promise<void> | null
}

type TKongMetadataError = Error & {
  code?: string
  status?: number
}

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ConnectionRefused',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_ABORTED'
])
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const SNAPSHOT_CONCURRENCY = 3
const KNOWN_STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'FRAX',
  'LUSD',
  'TUSD',
  'USDE',
  'SUSDE',
  'GHO',
  'CRVUSD',
  'USD0',
  'PYUSD',
  'USDP',
  'SDAI',
  'AUSD',
  'BOLD'
])
const vaultListState: TVaultListState = {
  vaultListCache: null,
  stakingToVaultMap: null,
  hasLoadedGlobalVaultList: false,
  loadPromise: null
}

function normalizeVaultCategory(category?: string | null): 'stable' | 'volatile' | null {
  const normalized = String(category ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === 'stablecoin') {
    return 'stable'
  }

  if (normalized === 'volatile' || normalized === 'auto') {
    return 'volatile'
  }

  return null
}

function deriveVaultCategory(symbols: Array<string | undefined>): 'stable' | 'volatile' {
  const haystack = symbols
    .filter((symbol): symbol is string => Boolean(symbol))
    .join(' ')
    .toUpperCase()

  for (const stable of KNOWN_STABLECOIN_SYMBOLS) {
    if (haystack.includes(stable)) {
      return 'stable'
    }
  }

  return 'volatile'
}

function resolveVaultCategory(args: {
  category?: string | null
  assetSymbol?: string
  vaultSymbol?: string
}): 'stable' | 'volatile' {
  return normalizeVaultCategory(args.category) ?? deriveVaultCategory([args.assetSymbol, args.vaultSymbol])
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isRetryableError(error: unknown): boolean {
  const kongError = error as Partial<TKongMetadataError>
  const code = typeof kongError?.code === 'string' ? kongError.code : null
  const status = typeof kongError?.status === 'number' ? kongError.status : null
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return (
    (code !== null && RETRYABLE_ERROR_CODES.has(code)) ||
    (status !== null && RETRYABLE_STATUS_CODES.has(status)) ||
    message.includes('socket connection was closed unexpectedly') ||
    message.includes('unable to connect') ||
    message.includes('timed out') ||
    message.includes('timeout')
  )
}

function buildMetadataMaps(vaults: KongVault[]): {
  vaultListCache: Map<string, VaultMetadata>
  stakingToVaultMap: Map<string, VaultMetadata>
} {
  return vaults.reduce<{
    vaultListCache: Map<string, VaultMetadata>
    stakingToVaultMap: Map<string, VaultMetadata>
  }>(
    (maps, vault) => {
      const version = inferVaultVersion(vault)
      const metadata: VaultMetadata = {
        address: vault.address.toLowerCase(),
        chainId: vault.chainId,
        version,
        isHidden: Boolean(vault.isHidden),
        category: resolveVaultCategory({
          category: vault.category,
          assetSymbol: vault.asset.symbol,
          vaultSymbol: vault.symbol
        }),
        token: {
          address: vault.asset.address.toLowerCase(),
          symbol: vault.asset.symbol,
          decimals: vault.asset.decimals
        },
        decimals: vault.decimals
      }

      const key = `${vault.chainId}:${vault.address.toLowerCase()}`
      maps.vaultListCache.set(key, metadata)

      if (vault.staking?.address) {
        const stakingKey = `${vault.chainId}:${vault.staking.address.toLowerCase()}`
        const stakingMetadata: VaultMetadata = {
          address: vault.staking.address.toLowerCase(),
          chainId: vault.chainId,
          version,
          isHidden: metadata.isHidden,
          category: metadata.category,
          token: {
            address: vault.address.toLowerCase(),
            symbol: vault.symbol,
            decimals: vault.decimals
          },
          decimals: vault.decimals
        }
        maps.stakingToVaultMap.set(stakingKey, stakingMetadata)
      }

      return maps
    },
    {
      vaultListCache: new Map<string, VaultMetadata>(),
      stakingToVaultMap: new Map<string, VaultMetadata>()
    }
  )
}

function inferVaultVersion(vault: { apiVersion?: string; v3?: boolean }): 'v2' | 'v3' {
  if (vault.v3 === true) {
    return 'v3'
  }

  return typeof vault.apiVersion === 'string' && vault.apiVersion.startsWith('3') ? 'v3' : 'v2'
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function ensureMetadataMaps(): {
  vaultListCache: Map<string, VaultMetadata>
  stakingToVaultMap: Map<string, VaultMetadata>
} {
  if (vaultListState.vaultListCache === null) {
    vaultListState.vaultListCache = new Map<string, VaultMetadata>()
  }

  if (vaultListState.stakingToVaultMap === null) {
    vaultListState.stakingToVaultMap = new Map<string, VaultMetadata>()
  }

  return {
    vaultListCache: vaultListState.vaultListCache,
    stakingToVaultMap: vaultListState.stakingToVaultMap
  }
}

function buildMetadataFromSnapshot(snapshot: KongVaultSnapshot): VaultMetadata | null {
  if (!snapshot.asset) {
    return null
  }

  return {
    address: snapshot.address.toLowerCase(),
    chainId: snapshot.chainId,
    version: inferVaultVersion(snapshot),
    isHidden: Boolean(snapshot.meta?.isHidden),
    category: resolveVaultCategory({
      category: snapshot.meta?.category,
      assetSymbol: snapshot.asset.symbol,
      vaultSymbol: snapshot.symbol
    }),
    token: {
      address: snapshot.asset.address.toLowerCase(),
      symbol: snapshot.asset.symbol,
      decimals: snapshot.asset.decimals
    },
    decimals: snapshot.decimals ?? 18
  }
}

function buildStakingMetadataFromSnapshot(stakingAddress: string, snapshot: KongVaultSnapshot): VaultMetadata | null {
  if (!snapshot.symbol || snapshot.decimals === undefined) {
    return null
  }

  return {
    address: stakingAddress.toLowerCase(),
    chainId: snapshot.chainId,
    version: inferVaultVersion(snapshot),
    isHidden: Boolean(snapshot.meta?.isHidden),
    category: resolveVaultCategory({
      category: snapshot.meta?.category,
      assetSymbol: snapshot.asset?.symbol,
      vaultSymbol: snapshot.symbol
    }),
    token: {
      address: snapshot.address.toLowerCase(),
      symbol: snapshot.symbol,
      decimals: snapshot.decimals
    },
    decimals: snapshot.decimals
  }
}

function storeMetadata(key: string, metadata: VaultMetadata): void {
  ensureMetadataMaps().vaultListCache.set(key, metadata)
}

function storeStakingMetadata(key: string, metadata: VaultMetadata): void {
  ensureMetadataMaps().stakingToVaultMap.set(key, metadata)
}

async function fetchVaultList(attempt = 0): Promise<KongVault[]> {
  const url = `${config.kongBaseUrl}/api/rest/list/vaults?origin=yearn`
  debugLog('vaults', 'fetching global vault list', { attempt: attempt + 1, url })

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
    if (!response.ok) {
      const error = new Error(`Kong vault list request failed: ${response.status}`) as TKongMetadataError
      error.status = response.status
      throw error
    }

    const vaults = (await response.json()) as KongVault[]
    debugLog('vaults', 'fetched global vault list', { attempt: attempt + 1, count: vaults.length })
    return vaults
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES || !isRetryableError(error)) {
      debugError('vaults', 'global vault list fetch failed', error, { attempt: attempt + 1 })
      throw error
    }

    debugError('vaults', 'retrying global vault list fetch', error, { nextAttempt: attempt + 2 })
    await wait(DEFAULT_RETRY_DELAY_MS * 2 ** attempt)
    return fetchVaultList(attempt + 1)
  }
}

async function fetchVaultSnapshot(chainId: number, vaultAddress: string, attempt = 0): Promise<KongVaultSnapshot> {
  const url = `${config.kongBaseUrl}/api/rest/snapshot/${chainId}/${vaultAddress}`
  debugLog('vaults', 'fetching vault snapshot fallback', {
    attempt: attempt + 1,
    chainId,
    vaultAddress
  })

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })

    if (!response.ok) {
      const error = new Error(
        `Kong snapshot request failed: ${response.status} for ${vaultAddress}`
      ) as TKongMetadataError
      error.status = response.status
      throw error
    }

    const snapshot = (await response.json()) as KongVaultSnapshot
    debugLog('vaults', 'fetched vault snapshot fallback', {
      attempt: attempt + 1,
      chainId,
      vaultAddress,
      hasAsset: snapshot.asset !== undefined
    })
    return snapshot
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES || !isRetryableError(error)) {
      debugError('vaults', 'vault snapshot fallback failed', error, {
        attempt: attempt + 1,
        chainId,
        vaultAddress
      })
      throw error
    }

    debugError('vaults', 'retrying vault snapshot fallback', error, {
      nextAttempt: attempt + 2,
      chainId,
      vaultAddress
    })
    await wait(DEFAULT_RETRY_DELAY_MS * 2 ** attempt)
    return fetchVaultSnapshot(chainId, vaultAddress, attempt + 1)
  }
}

async function fetchFallbackMetadataForVault(
  chainId: number,
  vaultAddress: string
): Promise<{ key: string; metadata: VaultMetadata } | null> {
  const normalizedAddress = vaultAddress.toLowerCase()

  if (isStakingVault(chainId, normalizedAddress)) {
    const underlyingConfig = getUnderlyingVault(normalizedAddress)

    if (!underlyingConfig || underlyingConfig.chainId !== chainId) {
      return null
    }

    const snapshot = await fetchVaultSnapshot(chainId, underlyingConfig.underlying.toLowerCase())
    const stakingMetadata = buildStakingMetadataFromSnapshot(normalizedAddress, snapshot)

    if (!stakingMetadata) {
      return null
    }

    storeStakingMetadata(`${chainId}:${normalizedAddress}`, stakingMetadata)
    return {
      key: `${chainId}:${normalizedAddress}`,
      metadata: stakingMetadata
    }
  }

  const snapshot = await fetchVaultSnapshot(chainId, normalizedAddress)
  const metadata = buildMetadataFromSnapshot(snapshot)

  if (!metadata) {
    return null
  }

  const key = `${chainId}:${normalizedAddress}`
  storeMetadata(key, metadata)

  if (snapshot.staking?.address) {
    const stakingAddress = snapshot.staking.address.toLowerCase()
    const stakingMetadata = buildStakingMetadataFromSnapshot(stakingAddress, snapshot)

    if (stakingMetadata) {
      storeStakingMetadata(`${chainId}:${stakingAddress}`, stakingMetadata)
    }
  }

  return { key, metadata }
}

async function fetchFallbackMetadata(
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Promise<Map<string, VaultMetadata>> {
  debugLog('vaults', 'using snapshot fallback for metadata', { requested: vaults.length })
  const uniqueVaults = Array.from(
    new Map(vaults.map((vault) => [`${vault.chainId}:${vault.vaultAddress.toLowerCase()}`, vault])).values()
  )

  const results = await chunkItems(uniqueVaults, SNAPSHOT_CONCURRENCY).reduce<
    Promise<Array<{ key: string; metadata: VaultMetadata }>>
  >(async (allResultsPromise, batch) => {
    const allResults = await allResultsPromise
    const batchResults = await Promise.allSettled(
      batch.map(({ chainId, vaultAddress }) => fetchFallbackMetadataForVault(chainId, vaultAddress))
    )

    const resolvedResults = batchResults.reduce<Array<{ key: string; metadata: VaultMetadata }>>((entries, result) => {
      if (result.status === 'rejected') {
        console.error('[Kong] Failed to fetch fallback vault metadata:', result.reason)
        debugError('vaults', 'fallback metadata fetch failed', result.reason)
        return entries
      }

      if (result.value === null) {
        return entries
      }

      entries.push(result.value)
      return entries
    }, [])

    return [...allResults, ...resolvedResults]
  }, Promise.resolve([]))

  return results.reduce<Map<string, VaultMetadata>>((map, { key, metadata }) => {
    map.set(key, metadata)
    return map
  }, new Map<string, VaultMetadata>())
}

async function loadVaultList(): Promise<void> {
  if (
    vaultListState.hasLoadedGlobalVaultList &&
    vaultListState.vaultListCache !== null &&
    vaultListState.stakingToVaultMap !== null
  ) {
    return
  }

  if (vaultListState.loadPromise !== null) {
    return vaultListState.loadPromise
  }

  vaultListState.loadPromise = fetchVaultList()
    .then((vaults) => {
      const maps = buildMetadataMaps(vaults)
      vaultListState.vaultListCache = maps.vaultListCache
      vaultListState.stakingToVaultMap = maps.stakingToVaultMap
      vaultListState.hasLoadedGlobalVaultList = true
      debugLog('vaults', 'stored global vault metadata maps', {
        vaults: maps.vaultListCache.size,
        stakingVaults: maps.stakingToVaultMap.size
      })
    })
    .catch((error) => {
      console.error('[Kong] Error fetching vault list:', error)
      debugError('vaults', 'global vault metadata load failed', error)

      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load vault metadata from Kong: ${message}`)
    })
    .finally(() => {
      vaultListState.loadPromise = null
    })

  return vaultListState.loadPromise
}

export async function fetchVaultMetadata(chainId: number, vaultAddress: string): Promise<VaultMetadata | null> {
  const metadata = await fetchMultipleVaultsMetadata([{ chainId, vaultAddress }])
  return metadata.get(`${chainId}:${vaultAddress.toLowerCase()}`) ?? null
}

export async function fetchMultipleVaultsMetadata(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  options?: { skipSnapshotFallback?: boolean }
): Promise<Map<string, VaultMetadata>> {
  debugLog('vaults', 'resolving metadata for request', { requested: vaults.length })
  const loadError = await loadVaultList()
    .then(() => null)
    .catch((error) => error as Error)

  const results = vaults.reduce<Map<string, VaultMetadata>>((results, { chainId, vaultAddress }) => {
    const key = `${chainId}:${vaultAddress.toLowerCase()}`

    if (vaultListState.vaultListCache?.has(key)) {
      results.set(key, vaultListState.vaultListCache!.get(key)!)
      return results
    }

    if (vaultListState.stakingToVaultMap?.has(key)) {
      results.set(key, vaultListState.stakingToVaultMap!.get(key)!)
    }

    return results
  }, new Map<string, VaultMetadata>())

  const missingVaults = vaults.filter(
    ({ chainId, vaultAddress }) => !results.has(`${chainId}:${vaultAddress.toLowerCase()}`)
  )

  if (missingVaults.length > 0 && !options?.skipSnapshotFallback) {
    debugLog('vaults', 'metadata missing from global cache, falling back to snapshots', {
      missing: missingVaults.length
    })
    const fallbackResults = await fetchFallbackMetadata(missingVaults)
    fallbackResults.forEach((metadata, key) => {
      results.set(key, metadata)
    })
  }

  if (results.size === 0 && loadError && !options?.skipSnapshotFallback) {
    throw loadError
  }

  debugLog('vaults', 'resolved metadata for request', {
    requested: vaults.length,
    resolved: results.size,
    loadError: loadError?.message ?? null
  })
  return results
}
