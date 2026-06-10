import {
  getVaultAddress,
  getVaultChainID,
  getVaultStakingAddress,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import { zeroAddress } from 'viem'
import { env } from '@/env'

type TokenLogoSourceParams = {
  address?: string
  chainId?: number
  logoURI?: string
  size?: 32 | 128
}

export type TTokenLogoSourceToken = {
  address: string
  chainID: number
  logoURI?: string
}

export type TKnownVaultTokenLogoMeta = {
  logoToken: TTokenLogoSourceToken
  tokenType: 'vault' | 'staking'
}

export function getDefaultTokenLogoSrc({
  address,
  chainId,
  size = 32
}: Omit<TokenLogoSourceParams, 'logoURI'>): string | undefined {
  if (!address || !chainId) {
    return undefined
  }

  return `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${address.toLowerCase()}/logo-${size}.png`
}

export function getTokenLogoSources({ address, chainId, logoURI, size = 32 }: TokenLogoSourceParams): {
  src: string
  altSrc?: string
} {
  const fallbackSrc = getDefaultTokenLogoSrc({ address, chainId, size }) ?? ''

  if (!logoURI) {
    return { src: fallbackSrc }
  }

  return {
    src: logoURI,
    altSrc: fallbackSrc && fallbackSrc !== logoURI ? fallbackSrc : undefined
  }
}

export function getKnownVaultTokenLogoMetaByAddress({
  allVaults,
  chainId
}: {
  allVaults: TDict<TKongVaultInput>
  chainId: number
}): Record<string, TKnownVaultTokenLogoMeta> {
  const entries = Object.values(allVaults)
    .filter((vault) => getVaultChainID(vault) === chainId)
    .flatMap((vault): Array<[string, TKnownVaultTokenLogoMeta]> => {
      const vaultAsset = getVaultToken(vault)
      const logoToken = {
        address: toAddress(vaultAsset.address),
        chainID: chainId,
        logoURI: undefined
      }
      const vaultEntry: [string, TKnownVaultTokenLogoMeta] = [
        toAddress(getVaultAddress(vault)).toLowerCase(),
        { logoToken, tokenType: 'vault' }
      ]
      const stakingAddress = getVaultStakingAddress(vault)
      const stakingEntries: Array<[string, TKnownVaultTokenLogoMeta]> =
        stakingAddress === zeroAddress
          ? []
          : [[toAddress(stakingAddress).toLowerCase(), { logoToken, tokenType: 'staking' }]]

      return [vaultEntry, ...stakingEntries]
    })

  return Object.fromEntries(entries)
}
