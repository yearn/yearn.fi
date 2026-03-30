import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultDecimals,
  getVaultStaking,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toNormalizedBN } from '@shared/utils'

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceGetter = (params: TTokenAndChain) => TNormalizedBN
type TPriceGetter = (params: TTokenAndChain) => { normalized: number }

export function getVaultSharePriceUsd(vault: TKongVaultInput, getPrice: TPriceGetter): number {
  const chainID = getVaultChainID(vault)
  const vaultAddress = getVaultAddress(vault)
  const directSharePrice = getPrice({ address: vaultAddress, chainID }).normalized
  if (directSharePrice > 0) {
    return directSharePrice
  }

  const assetToken = getVaultToken(vault)
  const assetPrice = getPrice({ address: assetToken.address, chainID }).normalized
  const pricePerShare = getVaultAPR(vault).pricePerShare.today
  if (assetPrice > 0 && pricePerShare > 0) {
    return assetPrice * pricePerShare
  }

  return getVaultTVL(vault).price
}

export function getVaultHoldingsUsd(
  vault: TKongVaultInput,
  getBalance: TBalanceGetter,
  getPrice: TPriceGetter
): number {
  const chainID = getVaultChainID(vault)
  const vaultDecimals = getVaultDecimals(vault)
  const vaultAddress = getVaultAddress(vault)
  const staking = getVaultStaking(vault)

  const vaultBalanceRaw = getBalance({ address: vaultAddress, chainID }).raw
  const stakingBalanceRaw = !isZeroAddress(staking.address) ? getBalance({ address: staking.address, chainID }).raw : 0n
  const totalShares = toNormalizedBN(vaultBalanceRaw + stakingBalanceRaw, vaultDecimals).normalized

  const sharePriceUsd = getVaultSharePriceUsd(vault, getPrice)
  return totalShares * sharePriceUsd
}
