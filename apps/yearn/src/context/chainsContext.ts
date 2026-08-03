import { createContext, useContext } from 'react'
import type { Chain } from 'viem/chains'
import type { TSupportedChainId } from '@/config/supportedChains'

export type TChainsContext = {
  chains: readonly Chain[]
  chainId: TSupportedChainId
  chainIdIntent: TSupportedChainId
  executionChainId: number
  getChainFromId: (chainId: number) => Chain | undefined
  getExecutionChainId: (chainId: number) => number | undefined
  switchNetwork: (chainId: number) => void
  isConnectedChainValid: boolean
  isConnected: boolean
}

export const chainsContext = createContext<TChainsContext>({} as TChainsContext)

export const useChains = (): TChainsContext => useContext(chainsContext)
