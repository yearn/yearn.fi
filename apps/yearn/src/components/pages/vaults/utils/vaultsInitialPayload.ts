import { getVaultView, type TKongVaultInput, type TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { patchYBoldVaults } from '@pages/vaults/domain/normalizeVault'
import { isCatalogYearnVault } from '@pages/vaults/utils/catalogYearnVault'
import type { TDict } from '@shared/types'
import { SUPPORTED_NETWORKS, toAddress } from '@shared/utils'
import type { TKongVaultList, TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { zeroAddress } from 'viem'

type TVaultPayloadValue = string | number | boolean | null
export type TSerializableKongVaultView = TVaultPayloadValue[]

export type TVaultsInitialPayload = {
  vaults: TSerializableKongVaultView[]
}

export type TVaultsInitialVaultSource = {
  vaults: TDict<TKongVaultView>
  allVaults: TDict<TKongVaultView>
  isLoadingVaultList: false
}

const SUPPORTED_CHAIN_IDS = new Set(SUPPORTED_NETWORKS.map((network) => network.id))
const PAYLOAD_INDEX = {
  address: 0,
  chainID: 1,
  version: 2,
  type: 3,
  kind: 4,
  symbol: 5,
  name: 6,
  category: 7,
  decimals: 8,
  tokenAddress: 9,
  tokenName: 10,
  tokenSymbol: 11,
  tokenDecimals: 12,
  tvl: 13,
  aprType: 14,
  netAPR: 15,
  feePerformance: 16,
  feeManagement: 17,
  stakingRewardsAPR: 18,
  gammaRewardAPR: 19,
  katanaAppRewardsAPR: 20,
  steerPointsPerDollar: 21,
  weekAgo: 22,
  monthAgo: 23,
  inception: 24,
  pricePerShareToday: 25,
  pricePerShareWeekAgo: 26,
  pricePerShareMonthAgo: 27,
  forwardType: 28,
  forwardNetAPR: 29,
  boost: 30,
  baseAPR: 31,
  rewardsAPR: 32,
  isRetired: 33,
  isBoosted: 34,
  isHighlighted: 35,
  isHidden: 36,
  riskLevel: 37,
  stakingAddress: 38,
  stakingAvailable: 39,
  stakingSource: 40,
  migrationAvailable: 41
} as const

function getStringValue(entry: TSerializableKongVaultView, index: number, fallback = ''): string {
  const value = entry[index]
  return typeof value === 'string' ? value : fallback
}

function getNumberValue(entry: TSerializableKongVaultView, index: number, fallback = 0): number {
  const value = entry[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getNullableNumberValue(entry: TSerializableKongVaultView, index: number): number | null {
  const value = entry[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getBooleanValue(entry: TSerializableKongVaultView, index: number): boolean {
  return entry[index] === true
}

function getVaultKindValue(entry: TSerializableKongVaultView): TKongVaultView['kind'] {
  const kind = getStringValue(entry, PAYLOAD_INDEX.kind)
  if (kind === 'Legacy' || kind === 'Multi Strategy' || kind === 'Single Strategy') {
    return kind
  }
  return 'Legacy'
}

function serializeVaultView(vault: TKongVaultView): TSerializableKongVaultView {
  return [
    vault.address,
    vault.chainID,
    vault.version,
    vault.type,
    vault.kind,
    vault.symbol,
    vault.name,
    vault.category,
    vault.decimals,
    vault.token.address,
    vault.token.name,
    vault.token.symbol,
    vault.token.decimals,
    vault.tvl.tvl,
    vault.apr.type,
    vault.apr.netAPR,
    vault.apr.fees.performance,
    vault.apr.fees.management,
    vault.apr.extra.stakingRewardsAPR,
    vault.apr.extra.gammaRewardAPR,
    vault.apr.extra.katanaAppRewardsAPR ?? null,
    vault.apr.extra.steerPointsPerDollar ?? null,
    vault.apr.points.weekAgo,
    vault.apr.points.monthAgo,
    vault.apr.points.inception,
    vault.apr.pricePerShare.today,
    vault.apr.pricePerShare.weekAgo,
    vault.apr.pricePerShare.monthAgo,
    vault.apr.forwardAPR.type,
    vault.apr.forwardAPR.netAPR,
    vault.apr.forwardAPR.composite.boost,
    vault.apr.forwardAPR.composite.baseAPR,
    vault.apr.forwardAPR.composite.rewardsAPR,
    vault.info.isRetired,
    vault.info.isBoosted,
    vault.info.isHighlighted,
    vault.info.isHidden,
    vault.info.riskLevel,
    vault.staking.address,
    vault.staking.available,
    vault.staking.source,
    vault.migration.available
  ]
}

function deserializeVaultView(entry: TSerializableKongVaultView): TKongVaultView {
  const tokenAddress = toAddress(getStringValue(entry, PAYLOAD_INDEX.tokenAddress, zeroAddress))
  const stakingAddress = toAddress(getStringValue(entry, PAYLOAD_INDEX.stakingAddress, zeroAddress))
  return {
    address: toAddress(getStringValue(entry, PAYLOAD_INDEX.address, zeroAddress)),
    version: getStringValue(entry, PAYLOAD_INDEX.version),
    type: getStringValue(entry, PAYLOAD_INDEX.type),
    kind: getVaultKindValue(entry),
    symbol: getStringValue(entry, PAYLOAD_INDEX.symbol),
    name: getStringValue(entry, PAYLOAD_INDEX.name),
    description: '',
    category: getStringValue(entry, PAYLOAD_INDEX.category),
    decimals: getNumberValue(entry, PAYLOAD_INDEX.decimals, 18),
    chainID: getNumberValue(entry, PAYLOAD_INDEX.chainID, 1),
    token: {
      address: tokenAddress,
      name: getStringValue(entry, PAYLOAD_INDEX.tokenName),
      symbol: getStringValue(entry, PAYLOAD_INDEX.tokenSymbol),
      description: '',
      decimals: getNumberValue(entry, PAYLOAD_INDEX.tokenDecimals, 18)
    },
    tvl: {
      totalAssets: 0n,
      tvl: getNumberValue(entry, PAYLOAD_INDEX.tvl),
      price: 0
    },
    apr: {
      type: getStringValue(entry, PAYLOAD_INDEX.aprType),
      netAPR: getNumberValue(entry, PAYLOAD_INDEX.netAPR),
      fees: {
        performance: getNumberValue(entry, PAYLOAD_INDEX.feePerformance),
        withdrawal: 0,
        management: getNumberValue(entry, PAYLOAD_INDEX.feeManagement)
      },
      extra: {
        stakingRewardsAPR: getNumberValue(entry, PAYLOAD_INDEX.stakingRewardsAPR),
        gammaRewardAPR: getNumberValue(entry, PAYLOAD_INDEX.gammaRewardAPR),
        katanaAppRewardsAPR: getNullableNumberValue(entry, PAYLOAD_INDEX.katanaAppRewardsAPR) ?? undefined,
        steerPointsPerDollar: getNullableNumberValue(entry, PAYLOAD_INDEX.steerPointsPerDollar) ?? undefined
      },
      points: {
        weekAgo: getNumberValue(entry, PAYLOAD_INDEX.weekAgo),
        monthAgo: getNumberValue(entry, PAYLOAD_INDEX.monthAgo),
        inception: getNumberValue(entry, PAYLOAD_INDEX.inception)
      },
      pricePerShare: {
        today: getNumberValue(entry, PAYLOAD_INDEX.pricePerShareToday),
        weekAgo: getNullableNumberValue(entry, PAYLOAD_INDEX.pricePerShareWeekAgo),
        monthAgo: getNullableNumberValue(entry, PAYLOAD_INDEX.pricePerShareMonthAgo)
      },
      forwardAPR: {
        type: getStringValue(entry, PAYLOAD_INDEX.forwardType),
        netAPR: getNumberValue(entry, PAYLOAD_INDEX.forwardNetAPR),
        composite: {
          boost: getNumberValue(entry, PAYLOAD_INDEX.boost),
          poolAPY: 0,
          boostedAPR: 0,
          baseAPR: getNumberValue(entry, PAYLOAD_INDEX.baseAPR),
          cvxAPR: 0,
          rewardsAPR: getNumberValue(entry, PAYLOAD_INDEX.rewardsAPR),
          v3OracleCurrentAPR: 0,
          v3OracleStratRatioAPR: 0,
          keepCRV: 0,
          keepVELO: 0,
          cvxKeepCRV: 0
        }
      }
    },
    featuringScore: 0,
    strategies: [],
    staking: {
      address: stakingAddress,
      available: getBooleanValue(entry, PAYLOAD_INDEX.stakingAvailable),
      source: getStringValue(entry, PAYLOAD_INDEX.stakingSource),
      rewards: null
    },
    migration: {
      available: getBooleanValue(entry, PAYLOAD_INDEX.migrationAvailable),
      address: zeroAddress,
      contract: zeroAddress
    },
    info: {
      sourceURL: '',
      riskLevel: getNumberValue(entry, PAYLOAD_INDEX.riskLevel, -1),
      riskScore: [],
      riskScoreComment: '',
      uiNotice: '',
      isRetired: getBooleanValue(entry, PAYLOAD_INDEX.isRetired),
      isBoosted: getBooleanValue(entry, PAYLOAD_INDEX.isBoosted),
      isHighlighted: getBooleanValue(entry, PAYLOAD_INDEX.isHighlighted),
      isHidden: getBooleanValue(entry, PAYLOAD_INDEX.isHidden)
    }
  }
}

function toVaultListMap(vaults: TKongVaultListItem[]): TDict<TKongVaultListItem> {
  return vaults.reduce((acc, item): TDict<TKongVaultListItem> => {
    acc[toAddress(item.address)] = item
    return acc
  }, {})
}

function toVaultViewMap(vaults: TSerializableKongVaultView[]): TDict<TKongVaultView> {
  return vaults.reduce((acc, vault): TDict<TKongVaultView> => {
    const hydratedVault = deserializeVaultView(vault)
    acc[toAddress(hydratedVault.address)] = hydratedVault
    return acc
  }, {})
}

function serializeVaults(vaults: TDict<TKongVaultInput>): TSerializableKongVaultView[] {
  return Object.values(vaults).map((vault) => serializeVaultView(getVaultView(vault)))
}

export function buildVaultsInitialPayload(kongVaultList: TKongVaultList): TVaultsInitialPayload {
  const supportedVaults = kongVaultList.filter((item) => SUPPORTED_CHAIN_IDS.has(item.chainId))
  const catalogVaults = patchYBoldVaults(toVaultListMap(supportedVaults.filter(isCatalogYearnVault)))

  return {
    vaults: serializeVaults(catalogVaults)
  }
}

export function getVaultsInitialVaultSource(payload?: TVaultsInitialPayload): TVaultsInitialVaultSource | undefined {
  if (!payload) {
    return undefined
  }
  const vaults = toVaultViewMap(payload.vaults)

  return {
    vaults,
    allVaults: vaults,
    isLoadingVaultList: false
  }
}
