import { type Address, isAddress, isAddressEqual } from 'viem'
import {
  createErc4626Adapter,
  createErc4626PositionValueReader,
  createYearnV2Adapter,
  createYearnV2PositionValueReader
} from '../headless/adapters'
import { createYBoldPreset, YBOLD_VAULT_ADDRESS } from '../presets/yBold'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'
import type { VaultWidgetConfigResolver } from './types'

type KongVault = {
  address: Address
  apiVersion?: string | null
  chainId: number
  decimals?: number | string | null
  name: string
  symbol?: string | null
  asset?: {
    address: Address
    decimals?: number | string | null
    name: string
    symbol: string
  } | null
}

type KongConfigResolverOptions = {
  baseUrl?: string
  fetcher?: typeof fetch
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

function createConfig(vault: KongVault): VaultWidgetConfig {
  if (!vault.asset) throw new Error('Vault metadata is missing its asset')

  const asset: VaultWidgetToken = {
    address: vault.asset.address,
    chainId: vault.chainId,
    decimals: normalizeDecimals(vault.asset.decimals),
    logoURI: tokenLogo(vault.chainId, vault.asset.address),
    name: vault.asset.name,
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
  const adapter = isYearnV2
    ? createYearnV2Adapter({ asset, positionToken, vaultAddress: vault.address })
    : createErc4626Adapter({ asset, vaultAddress: vault.address })

  return {
    id: `${vault.chainId}:${vault.address.toLowerCase()}`,
    name: vault.name,
    chainId: vault.chainId,
    vaultAddress: vault.address,
    positionToken,
    depositTokens: [asset],
    withdrawTokens: [asset],
    adapters: [adapter],
    modes: ['deposit', 'withdraw', 'info'],
    readPositionValue: isYearnV2
      ? createYearnV2PositionValueReader({ positionToken, vaultAddress: vault.address })
      : createErc4626PositionValueReader({ vaultAddress: vault.address }),
    display: {
      approvalSpenderName: { deposit: positionToken.symbol },
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
