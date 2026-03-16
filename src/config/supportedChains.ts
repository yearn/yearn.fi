import type { Chain } from 'viem'
import type { TCanonicalChainId } from './chainDefinitions'
import { supportedCanonicalChains, supportedExecutionChains } from './tenderly'

export const supportedChains = supportedExecutionChains
export const supportedAppChains = supportedCanonicalChains

export type TSupportedChainId = TCanonicalChainId
export type TSupportedChain = Chain
