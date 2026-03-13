import { usdtAbi } from '@shared/contracts/abi/usdt.abi'
import { toAddress } from '@shared/utils/tools.address'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'

const TOKENS_WITH_NON_STANDARD_APPROVE_ABI = new Set([
  toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  toAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'),
  toAddress('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  toAddress('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9')
])

export function getApproveAbi(tokenAddress?: Address) {
  if (!tokenAddress) {
    return erc20Abi
  }

  return TOKENS_WITH_NON_STANDARD_APPROVE_ABI.has(toAddress(tokenAddress)) ? usdtAbi : erc20Abi
}
