import { useFetchYearnPrices } from '@shared/hooks/useFetchYearnPrices'
import type { TAddress, TNormalizedBN } from '@shared/types'
import { toAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import type { TYearnPricesByChain, TYearnPriceToken } from '@shared/utils/yearnPrices'
import { useCallback } from 'react'

type TTokenAndChain = { address: TAddress; chainID: number }

export function useYearnSpotPrices(tokens: Array<TYearnPriceToken | null | undefined>): {
  prices: TYearnPricesByChain
  getPrice: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
} {
  const prices = useFetchYearnPrices(tokens)
  const getPrice = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN => {
      const price = prices?.[chainID]?.[toAddress(address)] ?? 0
      if (!Number.isFinite(price) || price <= 0) {
        return zeroNormalizedBN
      }
      return toNormalizedBN(Math.round(price * 1_000_000), 6) || zeroNormalizedBN
    },
    [prices]
  )

  return { prices, getPrice }
}
