import { getCommonTokens } from '@yearn/chains'
import type { Address } from 'viem'

export const DEPOSIT_COMMON_TOKENS_BY_CHAIN = getCommonTokens('yearn', 'deposit')
export const WITHDRAW_COMMON_TOKENS_BY_CHAIN = getCommonTokens('yearn', 'withdraw')

export const getPriorityTokens = (
  chainId: number,
  vaultAddress: Address,
  stakingAddress?: Address
): Record<number, Address[]> => {
  const baseTokens = { ...WITHDRAW_COMMON_TOKENS_BY_CHAIN }
  if (stakingAddress) {
    baseTokens[chainId] = [vaultAddress, ...(baseTokens[chainId] || [])]
  }
  return baseTokens
}
