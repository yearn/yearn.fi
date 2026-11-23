import type { Chain } from 'viem'
import { supportedCanonicalChains, supportedExecutionChains } from '@/config/localForkRuntime'
import type { TCanonicalChainId } from './chainDefinitions'

export const supportedChains = supportedCanonicalChains
export const supportedAppChains = supportedCanonicalChains
export const supportedWalletChains = supportedExecutionChains

export type TSupportedChainId = TCanonicalChainId
export type TSupportedChain = Chain
