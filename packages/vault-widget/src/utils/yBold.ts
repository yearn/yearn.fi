import {
  BOLD_ADDRESS,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS,
  YBOLD_ZAPPER_ADDRESS
} from '@yearn/vault-widget/ybold'
import { type Address, isAddressEqual } from 'viem'

export { BOLD_ADDRESS, YBOLD_ZAPPER_ADDRESS }

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
