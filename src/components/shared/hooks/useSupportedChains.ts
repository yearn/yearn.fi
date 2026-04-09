'use client'

import { useMemo } from 'react'
import type { Chain } from 'viem/chains'
import { retrieveConfig } from '../utils/wagmi'

/******************************************************************************
 ** The useSupportedChains hook returns an array of supported chains, based on
 ** the injected connector.
 *****************************************************************************/
export function useSupportedChains(): Chain[] {
  const supportedChains = useMemo((): Chain[] => {
    const config = retrieveConfig()
    return [...config.chains]
  }, [])

  return supportedChains
}
