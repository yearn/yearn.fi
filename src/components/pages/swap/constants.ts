import { DEPOSIT_COMMON_TOKENS_BY_CHAIN } from '@pages/vaults/components/widget/withdraw/constants'
import { ETH_TOKEN_ADDRESS, toAddress } from '@shared/utils'
import type { Address } from 'viem'

export const SWAP_CHAIN_IDS = [1, 10, 137, 42161, 8453, 747474] as const

export type TSwapChainId = (typeof SWAP_CHAIN_IDS)[number]

export const DEFAULT_SWAP_FROM_CHAIN_ID: TSwapChainId = 1
export const DEFAULT_SWAP_TO_CHAIN_ID: TSwapChainId = 1
export const DEFAULT_SWAP_FROM_TOKEN = toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
export const DEFAULT_SWAP_TO_TOKEN = ETH_TOKEN_ADDRESS

export const MAJOR_SWAP_TOKENS: Record<TSwapChainId, Address[]> = {
  1: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[1]],
  10: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[10]],
  137: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[137]],
  42161: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[42161]],
  8453: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[8453]],
  747474: [ETH_TOKEN_ADDRESS, ...DEPOSIT_COMMON_TOKENS_BY_CHAIN[747474]]
}

export function isSwapChainId(value: number): value is TSwapChainId {
  return SWAP_CHAIN_IDS.includes(value as TSwapChainId)
}
