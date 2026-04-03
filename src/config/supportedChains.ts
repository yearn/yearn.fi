import type { Chain } from 'viem'
import type { TCanonicalChainId } from './chainDefinitions'
import { supportedCanonicalChains, supportedExecutionChains } from './tenderly'

export const supportedChains = supportedCanonicalChains
export const supportedAppChains = supportedCanonicalChains
export const supportedWalletChains = supportedExecutionChains

export type TSupportedChainId = TCanonicalChainId
export type TSupportedChain = Chain
