import type { Address } from 'viem'
import { createErc4626Adapter, createErc4626PositionValueReader } from '../headless/adapters'
import type { VaultWidgetConfig, VaultWidgetFamilyPreset, VaultWidgetToken } from '../types'

export const YVBTC_CHAIN_ID = 1
export const YVBTC_UNLOCKED_ADDRESS = '0xb8787E236e699654F910CAD14F338d0DdB529Fd7' as Address
export const YVBTC_LOCKED_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const yvBtcAssetToken: VaultWidgetToken = {
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  chainId: YVBTC_CHAIN_ID,
  decimals: 8,
  logoURI: 'https://assets.yearn.fi/tokens/1/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599/logo-128.png',
  name: 'Wrapped BTC',
  symbol: 'WBTC'
}

export type CreateYvBtcPresetOptions = {
  asset?: VaultWidgetToken
  assetPriceUsd?: number
  estimatedApr?: number
}

export function createYvBtcPreset(options: CreateYvBtcPresetOptions = {}): VaultWidgetConfig {
  const asset = options.asset ?? yvBtcAssetToken
  const readPositionValue = createErc4626PositionValueReader({ vaultAddress: YVBTC_UNLOCKED_ADDRESS })
  return {
    id: 'yvBTC:unlocked',
    name: 'yvBTC (Unlocked)',
    chainId: YVBTC_CHAIN_ID,
    vaultAddress: YVBTC_UNLOCKED_ADDRESS,
    positionToken: {
      address: YVBTC_UNLOCKED_ADDRESS,
      chainId: YVBTC_CHAIN_ID,
      decimals: 18,
      logoURI: `https://assets.yearn.fi/tokens/1/${YVBTC_UNLOCKED_ADDRESS.toLowerCase()}/logo-128.png`,
      name: 'yvBTC Unlocked',
      symbol: 'yvBTC'
    },
    depositTokens: [asset],
    withdrawTokens: [asset],
    adapters: [createErc4626Adapter({ asset, vaultAddress: YVBTC_UNLOCKED_ADDRESS })],
    modes: ['deposit', 'withdraw', 'info'],
    readPositionValue,
    display: {
      approvalSpenderName: { deposit: 'yvBTC' },
      assetPriceUsd: options.assetPriceUsd,
      estimatedApr: options.estimatedApr,
      positionLabel: 'Unlocked vault shares'
    }
  }
}

export function createYvBtcFamilyPreset(options: CreateYvBtcPresetOptions = {}): VaultWidgetFamilyPreset {
  return {
    id: 'yvBTC',
    name: 'yvBTC',
    defaultVariant: 'unlocked',
    variants: [
      {
        id: 'unlocked',
        label: 'Unlocked',
        description: 'Liquid yvBTC deposits and withdrawals.',
        available: true,
        config: createYvBtcPreset(options)
      },
      {
        id: 'locked',
        label: 'Locked',
        description: 'The locked yvBTC contract has not launched.',
        available: false,
        unavailableMessage: 'Locked yvBTC is not live yet.'
      }
    ]
  }
}
