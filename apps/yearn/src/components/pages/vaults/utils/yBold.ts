import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { toAddress } from '@shared/utils'
import { type Address, isAddressEqual } from 'viem'

export const BOLD_ADDRESS = toAddress('0x6440f144b7e50D6a8439336510312d2F54beB01D') as Address
export const YBOLD_ZAPPER_ADDRESS = toAddress('0xe7099092533a3fb693bb123cd96b8e53b4d83c58') as Address

interface IsYBoldZapperDepositRouteParams {
  depositToken: Address
  assetAddress: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
}

interface IsYBoldZapperWithdrawRouteParams {
  sourceToken: Address
  withdrawToken: Address
  assetAddress: Address
  vaultAddress: Address
  stakingAddress?: Address
  withdrawalSource: 'vault' | 'staking' | null
  chainId: number
  outputChainId: number
}

export function isYBoldZapperDepositRoute({
  depositToken,
  assetAddress,
  destinationToken,
  vaultAddress,
  stakingAddress
}: IsYBoldZapperDepositRouteParams): boolean {
  return (
    isAddressEqual(depositToken, BOLD_ADDRESS) &&
    isAddressEqual(assetAddress, BOLD_ADDRESS) &&
    isAddressEqual(vaultAddress, YBOLD_VAULT_ADDRESS) &&
    !!stakingAddress &&
    isAddressEqual(stakingAddress, YBOLD_STAKING_ADDRESS) &&
    isAddressEqual(destinationToken, YBOLD_STAKING_ADDRESS)
  )
}

export function isYBoldZapperWithdrawRoute({
  sourceToken,
  withdrawToken,
  assetAddress,
  vaultAddress,
  stakingAddress,
  withdrawalSource,
  chainId,
  outputChainId
}: IsYBoldZapperWithdrawRouteParams): boolean {
  return (
    chainId === 1 &&
    outputChainId === 1 &&
    withdrawalSource === 'staking' &&
    isAddressEqual(sourceToken, YBOLD_STAKING_ADDRESS) &&
    isAddressEqual(withdrawToken, BOLD_ADDRESS) &&
    isAddressEqual(assetAddress, BOLD_ADDRESS) &&
    isAddressEqual(vaultAddress, YBOLD_VAULT_ADDRESS) &&
    !!stakingAddress &&
    isAddressEqual(stakingAddress, YBOLD_STAKING_ADDRESS)
  )
}
