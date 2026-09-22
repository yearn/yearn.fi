import { getAppChain, getAppChains } from '@yearn/chains'

export const SUPPORTED_CHAINS = getAppChains('erc4626')
export const getChain = (chainId: number) => getAppChain('erc4626', chainId)
export const resolveChainId = (chainId: number | undefined) => (chainId && getChain(chainId) ? chainId : undefined)
