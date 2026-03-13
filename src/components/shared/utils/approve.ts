import { usdtAbi } from '@shared/contracts/abi/usdt.abi'
import { toAddress } from '@shared/utils/tools.address'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'

const TOKENS_WITH_NON_STANDARD_APPROVE_ABI = new Set([toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')])

export function getApproveAbi(tokenAddress?: Address) {
  if (!tokenAddress) {
    return erc20Abi
  }

  return TOKENS_WITH_NON_STANDARD_APPROVE_ABI.has(toAddress(tokenAddress)) ? usdtAbi : erc20Abi
}
