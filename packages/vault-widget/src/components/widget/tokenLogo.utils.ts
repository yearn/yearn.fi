import type { VaultWidgetAssetsRuntime, VaultWidgetCatalogVault } from '@yearn/vault-widget/runtime'
import { type Address, isAddress, isAddressEqual, zeroAddress } from 'viem'

type TokenLogoSourceParams = {
  address?: string
  assets?: Pick<VaultWidgetAssetsRuntime, 'getTokenLogoUrl'>
  chainId?: number
  logoURI?: string
  size?: 32 | 128
}

export type TTokenLogoSourceToken = {
  address: Address
  chainId: number
  logoURI?: string
}

export type TKnownVaultTokenLogoMeta = {
  logoToken: TTokenLogoSourceToken
  tokenType: 'staking' | 'vault'
}

export function getDefaultTokenLogoSrc({
  address,
  assets,
  chainId,
  size = 32
}: Omit<TokenLogoSourceParams, 'logoURI'>): string | undefined {
  if (!address || !chainId || !assets || !isAddress(address)) {
    return undefined
  }

  return assets.getTokenLogoUrl({ address, chainId, size })
}

export function getTokenLogoSources({ address, assets, chainId, logoURI, size = 32 }: TokenLogoSourceParams): {
  src: string
  altSrc?: string
} {
  const fallbackSrc = getDefaultTokenLogoSrc({ address, assets, chainId, size }) ?? ''

  if (!logoURI) {
    return { src: fallbackSrc }
  }

  return {
    src: logoURI,
    altSrc: fallbackSrc && fallbackSrc !== logoURI ? fallbackSrc : undefined
  }
}

type VaultCatalog = readonly VaultWidgetCatalogVault[] | Readonly<Record<string, VaultWidgetCatalogVault>>

function getCatalogVaults(allVaults: VaultCatalog): readonly VaultWidgetCatalogVault[] {
  return Array.isArray(allVaults)
    ? allVaults
    : Object.values(allVaults as Readonly<Record<string, VaultWidgetCatalogVault>>)
}

export function getKnownVaultTokenLogoMetaByAddress({
  allVaults,
  chainId
}: {
  allVaults: VaultCatalog
  chainId: number
}): Record<string, TKnownVaultTokenLogoMeta> {
  const entries = getCatalogVaults(allVaults)
    .filter((vault) => vault.chainId === chainId)
    .flatMap((vault): Array<[string, TKnownVaultTokenLogoMeta]> => {
      const logoToken = {
        address: vault.assetAddress,
        chainId,
        logoURI: undefined
      }
      const vaultEntry: [string, TKnownVaultTokenLogoMeta] = [
        vault.address.toLowerCase(),
        { logoToken, tokenType: 'vault' }
      ]
      const stakingAddress = vault.stakingAddress
      const stakingEntries: Array<[string, TKnownVaultTokenLogoMeta]> =
        stakingAddress && !isAddressEqual(stakingAddress, zeroAddress)
          ? [[stakingAddress.toLowerCase(), { logoToken, tokenType: 'staking' }]]
          : []

      return [vaultEntry, ...stakingEntries]
    })

  return Object.fromEntries(entries)
}
