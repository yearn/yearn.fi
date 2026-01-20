import { katana } from '@shared/utils/wagmi'
import { arbitrum, base, fantom, mainnet, optimism, polygon, sonic } from 'viem/chains'

export const supportedChains = [mainnet, optimism, polygon, fantom, base, arbitrum, sonic, katana] as const
export type TSupportedChainId = (typeof supportedChains)[number]['id']
