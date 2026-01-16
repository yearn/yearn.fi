import { createContext, useContext } from 'react'
import type { Chain } from 'viem/chains'
import type { TSupportedChainId } from '@/config/supportedChains'

export type TChainsContext = {
  chains: readonly Chain[]
  chainId: TSupportedChainId
  chainIdIntent: TSupportedChainId
  getChainFromId: (chainId: number) => Chain | undefined
  switchNetwork: (chainId: number) => void
  isConnectedChainValid: boolean
  isConnected: boolean
}

export const chainsContext = createContext<TChainsContext>({} as TChainsContext)

export const useChains = (): TChainsContext => useContext(chainsContext)
