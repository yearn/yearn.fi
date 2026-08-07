import { toAddress } from '@shared/utils'
import { type Address, isAddress } from 'viem'
import {
  DEFAULT_SWAP_FROM_CHAIN_ID,
  DEFAULT_SWAP_FROM_TOKEN,
  DEFAULT_SWAP_TO_CHAIN_ID,
  DEFAULT_SWAP_TO_TOKEN,
  isSwapChainId,
  type TSwapChainId
} from './constants'

export type TSwapSelection = {
  fromChainId: TSwapChainId
  fromToken: Address
  toChainId: TSwapChainId
  toToken: Address
}

export const DEFAULT_SWAP_SELECTION: TSwapSelection = {
  fromChainId: DEFAULT_SWAP_FROM_CHAIN_ID,
  fromToken: DEFAULT_SWAP_FROM_TOKEN,
  toChainId: DEFAULT_SWAP_TO_CHAIN_ID,
  toToken: DEFAULT_SWAP_TO_TOKEN
}

function parseChain(value: string | null, fallback: TSwapChainId): TSwapChainId {
  const parsed = Number(value)
  return isSwapChainId(parsed) ? parsed : fallback
}

function parseToken(value: string | null, fallback: Address): Address {
  return value && isAddress(value) ? toAddress(value) : fallback
}

export function parseSwapSelection(params: URLSearchParams): TSwapSelection {
  return {
    fromChainId: parseChain(params.get('fromChain'), DEFAULT_SWAP_SELECTION.fromChainId),
    fromToken: parseToken(params.get('from'), DEFAULT_SWAP_SELECTION.fromToken),
    toChainId: parseChain(params.get('toChain'), DEFAULT_SWAP_SELECTION.toChainId),
    toToken: parseToken(params.get('to'), DEFAULT_SWAP_SELECTION.toToken)
  }
}

export function buildSwapSearchParams(selection: TSwapSelection): URLSearchParams {
  return new URLSearchParams({
    fromChain: String(selection.fromChainId),
    from: selection.fromToken,
    toChain: String(selection.toChainId),
    to: selection.toToken
  })
}
