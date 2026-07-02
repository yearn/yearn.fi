import { useYearnSpotPrices } from '@shared/hooks/useYearnSpotPrices'
import type { TAddress } from '@shared/types'

/******************************************************************************
 ** The useYearnTokenPrice hook is used to retrieve the price of a token from
 ** yearn-prices spot. The price is returned with a fallback of 0.
 *****************************************************************************/
export function useYearnTokenPrice({ address, chainID }: { address: TAddress; chainID: number }): number {
  const { getPrice } = useYearnSpotPrices([{ address, chainID }])
  return getPrice({ address, chainID }).normalized
}
