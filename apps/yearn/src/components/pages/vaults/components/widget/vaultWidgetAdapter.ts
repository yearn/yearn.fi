import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultDecimals,
  getVaultInfo,
  getVaultMigration,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultVersion,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { TToken } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import type {
  Token as SharedWidgetToken,
  VaultUserData as SharedWidgetUserData,
  VaultWidgetVault,
  WidgetAddress
} from '@yearn/vault-widget'

const toOptionalAddress = (address: string | undefined): WidgetAddress | undefined => {
  if (!address || isZeroAddress(address)) {
    return undefined
  }
  return toAddress(address)
}

export function normalizeVaultForWidget(vault: TKongVaultInput): VaultWidgetVault {
  const asset = getVaultToken(vault)
  const staking = getVaultStaking(vault)
  const stakingAddress = toOptionalAddress(staking.address)
  const migration = getVaultMigration(vault)
  const migrationAddress = toOptionalAddress(migration.address)
  const migrationContract = toOptionalAddress(migration.contract)
  const info = getVaultInfo(vault)

  return {
    address: toAddress(getVaultAddress(vault)),
    chainId: getVaultChainID(vault),
    version: getVaultVersion(vault),
    decimals: getVaultDecimals(vault),
    symbol: getVaultSymbol(vault),
    name: getVaultName(vault),
    asset: {
      address: toAddress(asset.address),
      decimals: asset.decimals,
      symbol: asset.symbol,
      name: asset.name
    },
    forwardAPR: getVaultAPR(vault).forwardAPR.netAPR,
    staking: stakingAddress
      ? {
          address: stakingAddress,
          source: staking.source || undefined
        }
      : undefined,
    migration: {
      available: migration.available,
      address: migrationAddress,
      contract: migrationContract
    },
    isRetired: info.isRetired,
    isHidden: info.isHidden
  }
}

type TNormalizableToken = SharedWidgetToken | TToken

export const normalizeTokenForWidget = (
  token: TNormalizableToken | undefined,
  fallbackChainId: number
): SharedWidgetToken | undefined => {
  if (!token?.address) {
    return undefined
  }

  return {
    address: toAddress(token.address),
    chainId: 'chainId' in token ? token.chainId : (token.chainID ?? fallbackChainId),
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    balance: token.balance,
    logoURI: token.logoURI,
    value: token.value
  }
}

export function normalizeVaultUserDataForWidget(
  userData: SharedWidgetUserData,
  fallbackChainId: number
): SharedWidgetUserData {
  return {
    ...userData,
    assetToken: normalizeTokenForWidget(userData.assetToken, fallbackChainId),
    vaultToken: normalizeTokenForWidget(userData.vaultToken, fallbackChainId),
    stakingToken: normalizeTokenForWidget(userData.stakingToken, fallbackChainId)
  }
}
