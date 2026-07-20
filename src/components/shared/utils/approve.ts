import { usdtAbi } from '@shared/contracts/abi/usdt.abi'
import { type Address, erc20Abi, getAddress } from 'viem'

const MAINNET_USDT_ADDRESS = getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')

const TOKENS_WITH_NON_STANDARD_APPROVE_ABI = new Set([MAINNET_USDT_ADDRESS])
const TOKENS_REQUIRING_ALLOWANCE_RESET_BEFORE_APPROVAL = new Set([MAINNET_USDT_ADDRESS])

export function getApproveAbi(tokenAddress?: Address) {
  if (!tokenAddress) {
    return erc20Abi
  }

  return TOKENS_WITH_NON_STANDARD_APPROVE_ABI.has(getAddress(tokenAddress)) ? usdtAbi : erc20Abi
}

export function requiresAllowanceResetBeforeApproval(tokenAddress?: Address): boolean {
  if (!tokenAddress) {
    return false
  }

  return TOKENS_REQUIRING_ALLOWANCE_RESET_BEFORE_APPROVAL.has(getAddress(tokenAddress))
}
