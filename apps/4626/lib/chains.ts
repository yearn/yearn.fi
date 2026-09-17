import { arbitrum, base, mainnet, optimism, polygon } from 'wagmi/chains'

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon] as const
export const getChain = (chainId: number) => SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
export const resolveChainId = (chainId: number | undefined) => (chainId && getChain(chainId) ? chainId : undefined)
