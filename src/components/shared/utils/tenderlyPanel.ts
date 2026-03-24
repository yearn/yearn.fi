import {
  getVaultAddress,
  getVaultChainID,
  getVaultDecimals,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { canonicalChains } from '@/config/chainDefinitions'
import type { TDict, TNDict, TToken } from '../types'
import type {
  TTenderlyConfiguredChainStatus,
  TTenderlyFundableAsset,
  TTenderlyFundTokenType,
  TTenderlySnapshotRecord
} from '../types/tenderly'
import { ETH_TOKEN_ADDRESS } from './constants'
import { toAddress } from './tools.address'
import { isZeroAddress } from './tools.is'

export type TTenderlySnapshotStorage = Record<string, TTenderlySnapshotRecord[]>
export type TTenderlyFastForwardUnit = 'minutes' | 'hours' | 'days'

type TTenderlyTimeInput = {
  amount: number
  unit: TTenderlyFastForwardUnit
  seconds: number
}

const SNAPSHOT_KIND_ORDER: Record<TTenderlySnapshotRecord['kind'], number> = {
  baseline: 0,
  snapshot: 1
}

const TOKEN_TYPE_PRIORITY: Record<TTenderlyFundTokenType, number> = {
  asset: 0,
  vault: 1,
  staking: 2
}

const TIME_UNIT_SECONDS: Record<TTenderlyFastForwardUnit, number> = {
  minutes: 60,
  hours: 3_600,
  days: 86_400
}

const COMMON_TENDERLY_ASSET_SYMBOLS = [
  'ETH',
  'WETH',
  'WBTC',
  'USDC',
  'USDT',
  'DAI',
  'USDS',
  'USDE',
  'SUSDE',
  'CRVUSD',
  'SDAI',
  'YVUSD'
]

const COMMON_TENDERLY_ASSET_PRIORITY = COMMON_TENDERLY_ASSET_SYMBOLS.reduce<Record<string, number>>(
  (accumulator, symbol, index) => {
    accumulator[symbol] = index
    return accumulator
  },
  {}
)

const COMMON_TENDERLY_PREFERRED_ADDRESSES: Record<number, Partial<Record<string, string>>> = {
  1: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    USDS: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    USDE: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
    SUSDE: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
    CRVUSD: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    SDAI: '0x83F20F44975D03b1b09e64809B757c47f942BEeA'
  }
}

export const TENDERLY_SNAPSHOT_STORAGE_KEY = 'yearn.fi/tenderly/snapshots'

export function getTenderlySnapshotBucketKey(canonicalChainId: number, executionChainId: number): string {
  return `${canonicalChainId}:${executionChainId}`
}

export function sortTenderlySnapshotRecords(records: TTenderlySnapshotRecord[]): TTenderlySnapshotRecord[] {
  return records.toSorted((left, right) => {
    const kindOrder = SNAPSHOT_KIND_ORDER[left.kind] - SNAPSHOT_KIND_ORDER[right.kind]
    if (kindOrder !== 0) {
      return kindOrder
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export function getValidBaselineSnapshot(records: TTenderlySnapshotRecord[]): TTenderlySnapshotRecord | undefined {
  return sortTenderlySnapshotRecords(records).find(
    (record) => record.kind === 'baseline' && record.lastKnownStatus === 'valid'
  )
}

export function getLastRestorableTenderlySnapshot(
  records: TTenderlySnapshotRecord[]
): TTenderlySnapshotRecord | undefined {
  const sortedRecords = sortTenderlySnapshotRecords(records)
  const latestSnapshot = sortedRecords.find(
    (record) => record.kind === 'snapshot' && record.lastKnownStatus === 'valid'
  )

  return latestSnapshot || getValidBaselineSnapshot(sortedRecords)
}

export function upsertTenderlySnapshotRecord(
  snapshotStorage: TTenderlySnapshotStorage,
  record: TTenderlySnapshotRecord
): TTenderlySnapshotStorage {
  const bucketKey = getTenderlySnapshotBucketKey(record.canonicalChainId, record.executionChainId)
  const previousRecords = snapshotStorage[bucketKey] || []
  const filteredRecords = previousRecords.filter((existingRecord) => {
    if (existingRecord.snapshotId === record.snapshotId) {
      return false
    }

    if (record.kind === 'baseline' && existingRecord.kind === 'baseline') {
      return false
    }

    return true
  })

  return {
    ...snapshotStorage,
    [bucketKey]: sortTenderlySnapshotRecords([record, ...filteredRecords])
  }
}

export function markTenderlySnapshotInvalid(
  snapshotStorage: TTenderlySnapshotStorage,
  params: { canonicalChainId: number; executionChainId: number; snapshotId: string }
): TTenderlySnapshotStorage {
  const bucketKey = getTenderlySnapshotBucketKey(params.canonicalChainId, params.executionChainId)
  const updatedRecords = (snapshotStorage[bucketKey] || []).map((record) =>
    record.snapshotId === params.snapshotId ? { ...record, lastKnownStatus: 'invalid' as const } : record
  )

  return {
    ...snapshotStorage,
    [bucketKey]: sortTenderlySnapshotRecords(updatedRecords)
  }
}

export function reconcileTenderlySnapshotStorageAfterRevert(
  snapshotStorage: TTenderlySnapshotStorage,
  params: {
    revertedSnapshotRecord: TTenderlySnapshotRecord
    replacementSnapshotRecord?: TTenderlySnapshotRecord
  }
): TTenderlySnapshotStorage {
  const bucketKey = getTenderlySnapshotBucketKey(
    params.revertedSnapshotRecord.canonicalChainId,
    params.revertedSnapshotRecord.executionChainId
  )
  const previousRecords = snapshotStorage[bucketKey] || []

  if (previousRecords.length === 0) {
    return params.replacementSnapshotRecord
      ? upsertTenderlySnapshotRecord(snapshotStorage, params.replacementSnapshotRecord)
      : snapshotStorage
  }

  const revertedAt = Date.parse(params.revertedSnapshotRecord.createdAt)
  const updatedRecords = previousRecords.map((record) => {
    const recordCreatedAt = Date.parse(record.createdAt)
    const isLaterSnapshot =
      record.kind === 'snapshot' &&
      Number.isFinite(revertedAt) &&
      Number.isFinite(recordCreatedAt) &&
      recordCreatedAt > revertedAt

    if (record.snapshotId !== params.revertedSnapshotRecord.snapshotId && !isLaterSnapshot) {
      return record
    }

    return { ...record, lastKnownStatus: 'invalid' as const }
  })
  const nextStorage = {
    ...snapshotStorage,
    [bucketKey]: sortTenderlySnapshotRecords(updatedRecords)
  }

  return params.replacementSnapshotRecord
    ? upsertTenderlySnapshotRecord(nextStorage, params.replacementSnapshotRecord)
    : nextStorage
}

export function clearTenderlySnapshotBucket(
  snapshotStorage: TTenderlySnapshotStorage,
  params: { canonicalChainId: number; executionChainId: number }
): TTenderlySnapshotStorage {
  const bucketKey = getTenderlySnapshotBucketKey(params.canonicalChainId, params.executionChainId)

  if (!(bucketKey in snapshotStorage)) {
    return snapshotStorage
  }

  const nextStorage = { ...snapshotStorage }
  delete nextStorage[bucketKey]
  return nextStorage
}

export function resolveDefaultTenderlyCanonicalChainId(
  configuredChains: TTenderlyConfiguredChainStatus[],
  preferredChainIds: Array<number | undefined>
): number | undefined {
  const availableCanonicalChainIds = configuredChains
    .filter((chain) => chain.hasAdminRpc)
    .map((chain) => chain.canonicalChainId)
  const preferredChainId = preferredChainIds.find((chainId) => availableCanonicalChainIds.includes(Number(chainId)))

  return preferredChainId ?? availableCanonicalChainIds[0]
}

export function convertTenderlyTimeAmountToSeconds(amount: number, unit: TTenderlyFastForwardUnit): number {
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0

  return Math.round(normalizedAmount * TIME_UNIT_SECONDS[unit])
}

export function addTenderlyTimeIncrement(params: {
  currentAmount: number
  currentUnit: TTenderlyFastForwardUnit
  addedAmount: number
  addedUnit: TTenderlyFastForwardUnit
}): TTenderlyTimeInput {
  const currentSeconds = convertTenderlyTimeAmountToSeconds(params.currentAmount, params.currentUnit)
  const addedSeconds = convertTenderlyTimeAmountToSeconds(params.addedAmount, params.addedUnit)

  if (currentSeconds <= 0) {
    return {
      amount: params.addedAmount,
      unit: params.addedUnit,
      seconds: addedSeconds
    }
  }

  const totalSeconds = currentSeconds + addedSeconds

  return {
    amount: Number((totalSeconds / TIME_UNIT_SECONDS[params.currentUnit]).toFixed(6)),
    unit: params.currentUnit,
    seconds: totalSeconds
  }
}

function getCanonicalNativeAsset(chainId: number): TTenderlyFundableAsset | undefined {
  const chain = canonicalChains.find((item) => item.id === chainId)
  if (!chain) {
    return undefined
  }

  return {
    chainId,
    address: toAddress(ETH_TOKEN_ADDRESS),
    name: chain.nativeCurrency.name,
    symbol: chain.nativeCurrency.symbol,
    decimals: chain.nativeCurrency.decimals,
    assetKind: 'native',
    tokenType: 'asset'
  }
}

function mergeFundableAsset(
  accumulator: Record<string, TTenderlyFundableAsset>,
  asset: TTenderlyFundableAsset
): Record<string, TTenderlyFundableAsset> {
  const key = `${asset.chainId}:${toAddress(asset.address)}`
  const existingAsset = accumulator[key]

  if (!existingAsset) {
    accumulator[key] = asset
    return accumulator
  }

  accumulator[key] =
    TOKEN_TYPE_PRIORITY[asset.tokenType] > TOKEN_TYPE_PRIORITY[existingAsset.tokenType]
      ? { ...asset, logoURI: asset.logoURI || existingAsset.logoURI }
      : {
          ...existingAsset,
          logoURI: existingAsset.logoURI || asset.logoURI
        }

  return accumulator
}

function getTenderlyFundableAssetPriority(asset: TTenderlyFundableAsset): number {
  return COMMON_TENDERLY_ASSET_PRIORITY[String(asset.symbol || '').toUpperCase()] ?? Number.MAX_SAFE_INTEGER
}

function getTenderlyPreferredAddressPriority(asset: TTenderlyFundableAsset): number {
  const preferredAddress =
    COMMON_TENDERLY_PREFERRED_ADDRESSES[asset.chainId]?.[String(asset.symbol || '').toUpperCase()]

  if (!preferredAddress) {
    return 1
  }

  return toAddress(asset.address) === toAddress(preferredAddress) ? 0 : 1
}

function compareTenderlyFundableAssets(left: TTenderlyFundableAsset, right: TTenderlyFundableAsset): number {
  if (left.assetKind !== right.assetKind) {
    return left.assetKind === 'native' ? -1 : 1
  }

  const commonAssetPriority = getTenderlyFundableAssetPriority(left) - getTenderlyFundableAssetPriority(right)
  if (commonAssetPriority !== 0) {
    return commonAssetPriority
  }

  const preferredAddressPriority =
    getTenderlyPreferredAddressPriority(left) - getTenderlyPreferredAddressPriority(right)
  if (preferredAddressPriority !== 0) {
    return preferredAddressPriority
  }

  if (left.tokenType !== right.tokenType) {
    return TOKEN_TYPE_PRIORITY[left.tokenType] - TOKEN_TYPE_PRIORITY[right.tokenType]
  }

  const symbolOrder = left.symbol.localeCompare(right.symbol, 'en-US')
  if (symbolOrder !== 0) {
    return symbolOrder
  }

  const nameOrder = left.name.localeCompare(right.name, 'en-US')
  if (nameOrder !== 0) {
    return nameOrder
  }

  return left.address.localeCompare(right.address, 'en-US')
}

function toFundableAssetFromToken(token: TToken, tokenType: TTenderlyFundTokenType = 'asset'): TTenderlyFundableAsset {
  return {
    chainId: token.chainID,
    address: toAddress(token.address),
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    assetKind: toAddress(token.address) === toAddress(ETH_TOKEN_ADDRESS) ? 'native' : 'erc20',
    tokenType,
    logoURI: token.logoURI
  }
}

export function buildTenderlyFundableAssets(params: {
  chainId: number
  tokenLists: TNDict<TDict<TToken>>
  allVaults: TDict<TKongVaultInput>
}): TTenderlyFundableAsset[] {
  const nativeAsset = getCanonicalNativeAsset(params.chainId)
  const tokenListAssets = Object.values(params.tokenLists[params.chainId] || {}).map((token) =>
    toFundableAssetFromToken(token)
  )
  const vaultAssets = Object.values(params.allVaults)
    .filter((vault) => getVaultChainID(vault) === params.chainId)
    .reduce<TTenderlyFundableAsset[]>((accumulator, vault) => {
      const assetToken = getVaultToken(vault)
      const vaultAddress = toAddress(getVaultAddress(vault))
      const staking = getVaultStaking(vault)

      const nextAssets = [
        !isZeroAddress(toAddress(assetToken.address))
          ? {
              chainId: params.chainId,
              address: toAddress(assetToken.address),
              name: assetToken.name,
              symbol: assetToken.symbol,
              decimals: assetToken.decimals,
              assetKind: toAddress(assetToken.address) === toAddress(ETH_TOKEN_ADDRESS) ? 'native' : 'erc20',
              tokenType: 'asset' as const
            }
          : undefined,
        !isZeroAddress(vaultAddress)
          ? {
              chainId: params.chainId,
              address: vaultAddress,
              name: getVaultName(vault),
              symbol: getVaultSymbol(vault),
              decimals: getVaultDecimals(vault),
              assetKind: 'erc20' as const,
              tokenType: 'vault' as const
            }
          : undefined,
        !isZeroAddress(toAddress(staking.address))
          ? {
              chainId: params.chainId,
              address: toAddress(staking.address),
              name: `${getVaultName(vault)} Staking`,
              symbol: getVaultSymbol(vault),
              decimals: getVaultDecimals(vault),
              assetKind: 'erc20' as const,
              tokenType: 'staking' as const
            }
          : undefined
      ].filter(Boolean)

      return accumulator.concat(nextAssets as TTenderlyFundableAsset[])
    }, [])

  return Object.values(
    [nativeAsset, ...tokenListAssets, ...vaultAssets]
      .filter(Boolean)
      .reduce<Record<string, TTenderlyFundableAsset>>(
        (accumulator, asset) => mergeFundableAsset(accumulator, asset as TTenderlyFundableAsset),
        {}
      )
  ).toSorted(compareTenderlyFundableAssets)
}

export function getDefaultTenderlyFundableAssets(
  assets: TTenderlyFundableAsset[],
  limit = 14
): TTenderlyFundableAsset[] {
  const seenKeys = new Set<string>()
  const dedupedAssets = assets.toSorted(compareTenderlyFundableAssets).filter((asset) => {
    const dedupeKey =
      asset.assetKind === 'native'
        ? `native:${asset.chainId}`
        : `${asset.tokenType}:${String(asset.symbol || '').toUpperCase()}`

    if (seenKeys.has(dedupeKey)) {
      return false
    }

    seenKeys.add(dedupeKey)
    return true
  })

  return dedupedAssets.slice(0, limit)
}
