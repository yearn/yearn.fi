import { useMemo } from 'react'
import type { Chain } from 'viem/chains'
import { supportedAppChains } from '@/config/supportedChains'

/******************************************************************************
 ** The useSupportedChains hook returns the canonical app chains used by vault
 ** filters, URLs, and query-state serialization.
 *****************************************************************************/
export function useSupportedChains(): Chain[] {
  const chains = useMemo((): Chain[] => [...supportedAppChains], [])

  return chains
}
