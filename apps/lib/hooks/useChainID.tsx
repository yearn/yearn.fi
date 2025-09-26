import { useMemo } from 'react'

import { useWeb3 } from '../contexts/useWeb3'

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

/***************************************************************************
 ** This hook can be used to grab the current injected wallet provider.
 ** It will return the name and icon of the wallet provider.
 **************************************************************************/
export function useChainID(defaultChainID?: number): TUseChainIDRes {
  const { chainID, onSwitchChain } = useWeb3()
  const safeChainID = useMemo((): number => {
    const fallbackChainID = defaultChainID || 1
    return toSafeChainID(chainID, fallbackChainID)
  }, [chainID, defaultChainID])

  return {
    chainID: Number(chainID || defaultChainID || 1),
    updateChainID: onSwitchChain,
    safeChainID
  }
}
