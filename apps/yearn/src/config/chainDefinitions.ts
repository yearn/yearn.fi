import { arbitrum, base, fantom, katana, mainnet, optimism, polygon, robinhood, sonic } from 'viem/chains'

// Define chains locally here only when they are unavailable in viem.
export { katana }

export const canonicalChains = [mainnet, optimism, polygon, fantom, base, arbitrum, sonic, katana, robinhood] as const

export type TCanonicalChainId = (typeof canonicalChains)[number]['id']
