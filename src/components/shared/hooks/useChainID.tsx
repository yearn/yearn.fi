import { useMemo } from 'react'
import { useChains } from '@/context/chainsContext'

export type TUseChainIDRes = {
  chainID: number
  updateChainID: (n: number) => void
  safeChainID: number
}

export const toSafeChainID = (chainID: number, fallback: number): number => {
  if ([1337, 31337].includes(chainID)) {
    return fallback
  }
  return chainID
}

export function useChainID(defaultChainID?: number): TUseChainIDRes {
  const { chainId, switchNetwork } = useChains()
  const safeChainID = useMemo((): number => {
    const fallbackChainID = defaultChainID || 1
    return toSafeChainID(chainId, fallbackChainID)
  }, [chainId, defaultChainID])

  return {
    chainID: Number(chainId || defaultChainID || 1),
    updateChainID: switchNetwork,
    safeChainID
  }
}
