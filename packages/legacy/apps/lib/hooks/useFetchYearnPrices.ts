import {useDeepCompareMemo} from '@react-hookz/web';
import type {TYDaemonPricesChain} from '../utils/schemas/yDaemonPricesSchema';
import {yDaemonPricesChainSchema} from '../utils/schemas/yDaemonPricesSchema';
import {useFetch} from './useFetch';
import {useYDaemonBaseURI} from './useYDaemonBaseURI';

/******************************************************************************
 ** The useFetchYearnPrices hook is used to fetch the prices of the tokens from
 ** the yDaemon API. It returns an object with the prices of the tokens,
 ** splitted by chain.
 *****************************************************************************/
function useFetchYearnPrices(): TYDaemonPricesChain {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const {data: prices} = useFetch<TYDaemonPricesChain>({
		endpoint: `${yDaemonBaseUriWithoutChain}/prices/all`,
		schema: yDaemonPricesChainSchema
	});

	const pricesUpdated = useDeepCompareMemo((): TYDaemonPricesChain => {
		if (!prices) {
			return {};
		}
		return prices;
	}, [prices]);

	return pricesUpdated;
}

export {useFetchYearnPrices};
