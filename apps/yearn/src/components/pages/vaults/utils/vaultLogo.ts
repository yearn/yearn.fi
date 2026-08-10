import { getVaultChainID, getVaultToken, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { env } from '@/env'
import { isYvBtcVault } from './yvBtc'
import { isYvUsdVault } from './yvUsd'

function getBaseUrl(): string {
  return env.BASE_URL || '/'
}

function getAssetsBaseUrl(): string {
  return env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI || ''
}

export function getVaultPrimaryLogoSrc(vault: TKongVaultInput): string {
  if (isYvUsdVault(vault)) {
    return `${getBaseUrl()}yvusd-128.png`
  }

  if (isYvBtcVault(vault)) {
    return `${getBaseUrl()}yvBTC-1.svg`
  }

  const chainID = getVaultChainID(vault)
  const token = getVaultToken(vault)
  return `${getAssetsBaseUrl()}/tokens/${chainID}/${toAddress(token.address).toLowerCase()}/logo-128.png`
}
