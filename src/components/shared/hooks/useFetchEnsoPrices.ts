import { useDeepCompareMemo } from '@react-hookz/web'
import type { TYDaemonPricesChain } from '../utils/schemas/yDaemonPricesSchema'
import { yDaemonPricesChainSchema } from '../utils/schemas/yDaemonPricesSchema'
import { useFetch } from './useFetch'

/******************************************************************************
 ** The useFetchEnsoPrices hook fetches token prices from the Enso API via our
 ** server-side proxy. Returns the same TYDaemonPricesChain shape so it's a
 ** drop-in replacement for useFetchYDaemonPrices.
 *****************************************************************************/
function useFetchEnsoPrices(): TYDaemonPricesChain {
  const { data: prices } = useFetch<TYDaemonPricesChain>({
    endpoint: '/api/enso/prices',
    schema: yDaemonPricesChainSchema
  })

  const pricesUpdated = useDeepCompareMemo((): TYDaemonPricesChain => {
    if (!prices) {
      return {}
    }
    return prices
  }, [prices])

  return pricesUpdated
}

export { useFetchEnsoPrices }
