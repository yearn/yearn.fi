import { getVaultChainID, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { isYvUsdVault } from './yvUsd'

function getBaseUrl(): string {
  return import.meta.env.BASE_URL || '/'
}

function getAssetsBaseUrl(): string {
  return import.meta.env.VITE_BASE_YEARN_ASSETS_URI || ''
}

export function getVaultPrimaryLogoSrc(vault: TKongVaultInput): string {
  if (isYvUsdVault(vault)) {
    return `${getBaseUrl()}yvusd-128.png`
  }

  const chainID = getVaultChainID(vault)
  const token = getVaultToken(vault)
  return `${getAssetsBaseUrl()}/tokens/${chainID}/${toAddress(token.address).toLowerCase()}/logo-128.png`
}
