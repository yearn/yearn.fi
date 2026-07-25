import { type Address, isAddress, isAddressEqual } from 'viem'
import {
  createErc4626Adapter,
  createErc4626PositionAmountReader,
  createErc4626PositionValueReader,
  createYearnV2Adapter,
  createYearnV2PositionAmountReader,
  createYearnV2PositionValueReader
} from '../headless/adapters'
import {
  createDepositAndStakeAdapter,
  createStakingAdapter,
  createStakingPositionAmountReader,
  createStakingPositionValueReader,
  createUnstakeAndWithdrawAdapter
} from '../headless/staking'
import { createYBoldPreset, YBOLD_VAULT_ADDRESS } from '../presets/yBold'
import { createYvBtcPreset, YVBTC_UNLOCKED_ADDRESS } from '../presets/yvBtc'
import { createYvUsdPreset, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../presets/yvUsd'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'
import type { VaultWidgetConfigResolver } from './types'

type KongVault = {
  address: Address
  apiVersion?: string | null
  chainId: number
  decimals?: number | string | null
  name: string
  symbol?: string | null
  apr?: {
    forwardAPR?: {
      netAPR?: number | null
    } | null
    netAPR?: number | null
  } | null
  asset?: {
    address: Address
    decimals?: number | string | null
    name: string
    symbol: string
  } | null
  tvl?: {
    price?: number | null
  } | null
  staking?: {
    address?: Address | null
    available?: boolean | null
    rewards?:
      | readonly {
          address: Address
          decimals?: number | string | null
          isFinished?: boolean | null
          name?: string | null
          price?: number | null
          symbol: string
        }[]
      | null
    source?: string | null
  } | null
  migration?: {
    address?: Address | null
    available?: boolean | null
    contract?: Address | null
    target?: Address | null
  } | null
  isRetired?: boolean | null
  meta?: {
    isRetired?: boolean | null
    migration?: {
      address?: Address | null
      available?: boolean | null
      contract?: Address | null
      target?: Address | null
    } | null
  } | null
}

type KongConfigResolverOptions = {
  baseUrl?: string
  fetcher?: typeof fetch
}

const MERKLE_TOKEN_ALLOWLIST_BY_CHAIN: Partial<Record<number, readonly Address[]>> = {
  747474: [
    '0x6E9C1F88a960fE63387eb4b71BC525a9313d8461',
    '0x3ba1fbC4c3aEA775d335b31fb53778f46FD3a330',
    '0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d',
    '0x0161A31702d6CF715aaa912d64c6A190FD0093aa'
  ]
}

function isKongVault(value: unknown): value is KongVault {
  if (!value || typeof value !== 'object') return false
  const vault = value as Partial<KongVault>
  return (
    typeof vault.chainId === 'number' &&
    typeof vault.name === 'string' &&
    typeof vault.address === 'string' &&
    isAddress(vault.address) &&
    !!vault.asset &&
    typeof vault.asset.address === 'string' &&
    isAddress(vault.asset.address) &&
    typeof vault.asset.name === 'string' &&
    typeof vault.asset.symbol === 'string'
  )
}

function tokenLogo(chainId: number, address: Address): string {
  return `https://assets.yearn.fi/tokens/${chainId}/${address.toLowerCase()}/logo-128.png`
}

function normalizeDecimals(value: number | string | null | undefined): number {
  const decimals = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255 ? decimals : 18
}

function getMigration(vault: KongVault): KongVault['migration'] {
  return vault.migration ?? vault.meta?.migration
}

function createConfig(vault: KongVault): VaultWidgetConfig {
  if (!vault.asset) throw new Error('Vault metadata is missing its asset')

  const asset: VaultWidgetToken = {
    address: vault.asset.address,
    chainId: vault.chainId,
    decimals: normalizeDecimals(vault.asset.decimals),
    logoURI: tokenLogo(vault.chainId, vault.asset.address),
    name: vault.asset.name,
    priceUsd: vault.tvl?.price ?? undefined,
    symbol: vault.asset.symbol
  }
  const positionToken: VaultWidgetToken = {
    address: vault.address,
    chainId: vault.chainId,
    decimals: normalizeDecimals(vault.decimals),
    logoURI: tokenLogo(vault.chainId, vault.address),
    name: vault.name,
    symbol: vault.symbol ?? vault.name
  }

  const isYearnV2 = Boolean(vault.apiVersion && !vault.apiVersion.startsWith('3') && !vault.apiVersion.startsWith('~3'))
  const stakingAddress =
    vault.staking?.available && vault.staking.address && isAddress(vault.staking.address)
      ? vault.staking.address
      : undefined
  const positionSourceId = stakingAddress ? 'vault' : undefined
  const migration = getMigration(vault)
  const migrationTarget = migration?.target ?? migration?.address
  const migrationConfig =
    migration?.available &&
    migrationTarget &&
    migration.contract &&
    isAddress(migrationTarget) &&
    isAddress(migration.contract)
      ? {
          migratorAddress: migration.contract,
          sourceVersion: vault.apiVersion ?? undefined,
          targetVault: migrationTarget
        }
      : undefined
  const rewardTokens =
    vault.staking?.rewards
      ?.filter(({ address }) => isAddress(address))
      .map((reward): VaultWidgetToken & { isFinished?: boolean } => ({
        address: reward.address,
        chainId: vault.chainId,
        decimals: normalizeDecimals(reward.decimals),
        isFinished: reward.isFinished ?? undefined,
        logoURI: tokenLogo(vault.chainId, reward.address),
        name: reward.name ?? undefined,
        priceUsd: reward.price ?? undefined,
        symbol: reward.symbol
      })) ?? []
  const merkleTokenAllowlist = MERKLE_TOKEN_ALLOWLIST_BY_CHAIN[vault.chainId]
  const rewardsConfig =
    rewardTokens.length > 0 || merkleTokenAllowlist
      ? {
          merkleTokenAllowlist,
          stakingAddress,
          stakingSource: vault.staking?.source ?? undefined,
          tokens: rewardTokens
        }
      : undefined
  const isRetired = vault.isRetired === true || vault.meta?.isRetired === true
  const modes = [
    ...(migrationConfig ? (['migrate'] as const) : isRetired ? [] : (['deposit'] as const)),
    'withdraw',
    ...(rewardsConfig ? (['rewards'] as const) : []),
    'info'
  ] as const
  const adapter = isYearnV2
    ? createYearnV2Adapter({ asset, positionSourceId, positionToken, vaultAddress: vault.address })
    : createErc4626Adapter({ asset, positionSourceId, vaultAddress: vault.address })
  const readPositionValue = isYearnV2
    ? createYearnV2PositionValueReader({ positionToken, vaultAddress: vault.address })
    : createErc4626PositionValueReader({ vaultAddress: vault.address })
  const readPositionAmount = isYearnV2
    ? createYearnV2PositionAmountReader({ positionToken, vaultAddress: vault.address })
    : createErc4626PositionAmountReader({ vaultAddress: vault.address })

  if (stakingAddress) {
    const stakingToken: VaultWidgetToken = {
      address: stakingAddress,
      chainId: vault.chainId,
      decimals: positionToken.decimals,
      logoURI: tokenLogo(vault.chainId, stakingAddress),
      name: `Staked ${positionToken.name}`,
      symbol: `st${positionToken.symbol}`
    }
    const stakingAdapter = createStakingAdapter({
      chainId: vault.chainId,
      positionSourceId: 'staked',
      source: vault.staking?.source ?? undefined,
      stakingAddress,
      stakingToken,
      vaultToken: positionToken
    })
    const readStakingValue = createStakingPositionValueReader({
      source: vault.staking?.source ?? undefined,
      stakingAddress
    })
    const readStakingAmount = createStakingPositionAmountReader({
      source: vault.staking?.source ?? undefined,
      stakingAddress
    })

    return {
      id: `${vault.chainId}:${vault.address.toLowerCase()}`,
      name: vault.name,
      chainId: vault.chainId,
      vaultAddress: vault.address,
      positionToken,
      positionSources: [
        {
          balanceLabel: 'Deposited shares',
          id: 'vault',
          label: 'Vault shares',
          token: positionToken,
          readAmount: readPositionAmount,
          readValue: readPositionValue
        },
        {
          balanceLabel: 'Staked shares',
          id: 'staked',
          label: 'Staked shares',
          token: stakingToken,
          withdrawLabel: 'You will unstake and redeem',
          readAmount: async (publicClient, assets) =>
            readStakingAmount(publicClient, await readPositionAmount(publicClient, assets)),
          readValue: async (publicClient, balance) =>
            readPositionValue(publicClient, await readStakingValue(publicClient, balance))
        }
      ],
      depositTokens: [asset, positionToken],
      withdrawTokens: [asset, positionToken],
      adapters: [
        createDepositAndStakeAdapter({
          assetToken: asset,
          stakingAdapter,
          stakingToken,
          vaultAdapter: adapter,
          vaultToken: positionToken
        }),
        adapter,
        stakingAdapter,
        createUnstakeAndWithdrawAdapter({
          assetToken: asset,
          positionSourceId: 'staked',
          stakingAdapter,
          vaultAdapter: adapter,
          vaultToken: positionToken
        })
      ],
      modes,
      defaultMode: migrationConfig ? 'migrate' : isRetired ? 'withdraw' : undefined,
      migration: migrationConfig,
      readPositionAmount,
      readPositionValue,
      rewards: rewardsConfig,
      display: {
        approvalSpenderName: { deposit: positionToken.symbol },
        assetPriceUsd: vault.tvl?.price ?? undefined,
        estimatedApr: vault.apr?.forwardAPR?.netAPR ?? vault.apr?.netAPR ?? undefined,
        positionLabel: 'Vault shares'
      }
    }
  }

  return {
    id: `${vault.chainId}:${vault.address.toLowerCase()}`,
    name: vault.name,
    chainId: vault.chainId,
    vaultAddress: vault.address,
    positionToken,
    depositTokens: [asset],
    withdrawTokens: [asset],
    adapters: [adapter],
    modes,
    defaultMode: migrationConfig ? 'migrate' : isRetired ? 'withdraw' : undefined,
    migration: migrationConfig,
    readPositionAmount,
    readPositionValue,
    rewards: rewardsConfig,
    display: {
      approvalSpenderName: { deposit: positionToken.symbol },
      assetPriceUsd: vault.tvl?.price ?? undefined,
      estimatedApr: vault.apr?.forwardAPR?.netAPR ?? vault.apr?.netAPR ?? undefined,
      positionLabel: 'Vault shares'
    }
  }
}

export function createKongVaultConfigResolver(options: KongConfigResolverOptions = {}): VaultWidgetConfigResolver {
  const baseUrl = (options.baseUrl ?? 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch

  return {
    async resolve(chainId, vaultAddress, signal): Promise<VaultWidgetConfig> {
      if (chainId === 1 && isAddressEqual(vaultAddress, YBOLD_VAULT_ADDRESS)) {
        return createYBoldPreset()
      }
      if (chainId === 1 && isAddressEqual(vaultAddress, YVUSD_LOCKED_ADDRESS)) {
        return createYvUsdPreset({ variant: 'locked' })
      }
      if (chainId === 1 && isAddressEqual(vaultAddress, YVUSD_UNLOCKED_ADDRESS)) {
        return createYvUsdPreset({ variant: 'unlocked' })
      }
      if (chainId === 1 && isAddressEqual(vaultAddress, YVBTC_UNLOCKED_ADDRESS)) {
        return createYvBtcPreset({})
      }

      const response = await fetcher(`${baseUrl}/snapshot/${chainId}/${vaultAddress}`, {
        cache: 'no-store',
        signal
      })
      if (!response.ok) throw new Error(`Unable to load vault metadata (${response.status})`)
      const payload: unknown = await response.json()
      if (!isKongVault(payload) || payload.chainId !== chainId || !isAddressEqual(payload.address, vaultAddress)) {
        throw new Error('Kong returned metadata for a different vault')
      }
      return createConfig(payload)
    }
  }
}
