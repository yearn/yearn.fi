import type { Address } from 'viem'
import { createErc4626Adapter, createErc4626PositionValueReader } from '../headless/adapters'
import { createLockedVaultAdapter, createLockedVaultPositionValueReader } from '../headless/lockedVault'
import type { VaultWidgetConfig, VaultWidgetFamilyPreset, VaultWidgetToken } from '../types'

export const YVUSD_CHAIN_ID = 1
export const YVUSD_ASSET_ADDRESS = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as Address
export const YVUSD_UNLOCKED_ADDRESS = '0x696d02Db93291651ED510704c9b286841d506987' as Address
export const YVUSD_LOCKED_ADDRESS = '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040' as Address
export const YVUSD_LOCKED_ZAP_ADDRESS = '0x7ba61c8e19414dcB8fe769a7Be63B508C8062bbA' as Address

const tokenLogo = (address: Address): string =>
  `https://assets.yearn.fi/tokens/${YVUSD_CHAIN_ID}/${address.toLowerCase()}/logo-128.png`

export const yvUsdAssetToken: VaultWidgetToken = {
  address: YVUSD_ASSET_ADDRESS,
  chainId: YVUSD_CHAIN_ID,
  decimals: 6,
  logoURI: tokenLogo(YVUSD_ASSET_ADDRESS),
  name: 'USD Coin',
  symbol: 'USDC'
}

export const yvUsdUnlockedToken: VaultWidgetToken = {
  address: YVUSD_UNLOCKED_ADDRESS,
  chainId: YVUSD_CHAIN_ID,
  decimals: 18,
  logoURI: tokenLogo(YVUSD_UNLOCKED_ADDRESS),
  name: 'yvUSD Unlocked',
  symbol: 'yvUSD'
}

export const yvUsdLockedToken: VaultWidgetToken = {
  address: YVUSD_LOCKED_ADDRESS,
  chainId: YVUSD_CHAIN_ID,
  decimals: 18,
  logoURI: tokenLogo(YVUSD_LOCKED_ADDRESS),
  name: 'yvUSD Locked',
  symbol: 'yvUSD (Locked)'
}

export type CreateYvUsdPresetOptions = {
  assetPriceUsd?: number
  estimatedApr?: number
  variant?: 'locked' | 'unlocked'
}

export function createYvUsdPreset(options: CreateYvUsdPresetOptions = {}): VaultWidgetConfig {
  const variant = options.variant ?? 'unlocked'
  const isLocked = variant === 'locked'
  const vaultAddress = isLocked ? YVUSD_LOCKED_ADDRESS : YVUSD_UNLOCKED_ADDRESS
  const positionToken = isLocked ? yvUsdLockedToken : yvUsdUnlockedToken
  const adapter = isLocked
    ? createLockedVaultAdapter({
        asset: yvUsdAssetToken,
        lockedVaultAddress: YVUSD_LOCKED_ADDRESS,
        positionToken: yvUsdLockedToken,
        unlockedVaultAddress: YVUSD_UNLOCKED_ADDRESS,
        zapAddress: YVUSD_LOCKED_ZAP_ADDRESS
      })
    : createErc4626Adapter({ asset: yvUsdAssetToken, vaultAddress })
  const readPositionValue = isLocked
    ? createLockedVaultPositionValueReader({
        lockedVaultAddress: YVUSD_LOCKED_ADDRESS,
        unlockedVaultAddress: YVUSD_UNLOCKED_ADDRESS
      })
    : createErc4626PositionValueReader({ vaultAddress })

  return {
    id: `yvUSD:${variant}`,
    name: isLocked ? 'yvUSD (Locked)' : 'yvUSD (Unlocked)',
    chainId: YVUSD_CHAIN_ID,
    vaultAddress,
    positionToken,
    depositTokens: [yvUsdAssetToken],
    withdrawTokens: [yvUsdAssetToken],
    adapters: [adapter],
    modes: ['deposit', 'withdraw', 'info'],
    readPositionValue,
    display: {
      approvalSpenderName: { deposit: isLocked ? 'yvUSD Locked Zap' : 'yvUSD' },
      assetPriceUsd: options.assetPriceUsd ?? 1,
      estimatedApr: options.estimatedApr,
      positionLabel: isLocked ? 'Locked vault shares' : 'Unlocked vault shares'
    }
  }
}

export function createYvUsdFamilyPreset(
  options: Omit<CreateYvUsdPresetOptions, 'variant'> = {}
): VaultWidgetFamilyPreset {
  return {
    id: 'yvUSD',
    name: 'yvUSD',
    defaultVariant: 'locked',
    variants: [
      {
        id: 'locked',
        label: 'Locked',
        description: 'Higher yield with a cooldown and withdrawal window.',
        available: true,
        config: createYvUsdPreset({ ...options, variant: 'locked' })
      },
      {
        id: 'unlocked',
        label: 'Unlocked',
        description: 'Liquid deposits without a cooldown.',
        available: true,
        config: createYvUsdPreset({ ...options, variant: 'unlocked' })
      }
    ]
  }
}
