import { arbitrum, base, mainnet, optimism, polygon, robinhood } from 'wagmi/chains'

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon, robinhood] as const
export const getChain = (chainId: number) => SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
export const resolveChainId = (chainId: number | undefined) => (chainId && getChain(chainId) ? chainId : undefined)
