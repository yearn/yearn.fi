import { useFetchEnsoPrices } from './useFetchEnsoPrices'

/******************************************************************************
 ** The useFetchYearnPrices hook is used to fetch the prices of the tokens.
 ** It delegates to the Enso price provider by default. To switch back to
 ** yDaemon, swap the import to useFetchYDaemonPrices.
 *****************************************************************************/
const useFetchYearnPrices = useFetchEnsoPrices

export { useFetchYearnPrices }
