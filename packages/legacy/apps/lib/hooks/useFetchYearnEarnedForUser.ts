import {useDeepCompareMemo} from '@react-hookz/web';

import {useWeb3} from '../contexts/useWeb3';
import {yDaemonEarnedSchema} from '../utils/schemas/yDaemonEarnedSchema';
import {useFetch} from './useFetch';
import {useYDaemonBaseURI} from './useYDaemonBaseURI';

import type {TYDaemonEarned} from '../utils/schemas/yDaemonEarnedSchema';

/******************************************************************************
 ** The useFetchYearnEarnedForUser hook is used to fetch an estimate of the
 ** amount earned by the user. This estimate is calculated by the yDaemon API
 ** based on the events emitted by the yearn contracts catched by the subgraph.
 *****************************************************************************/
function useFetchYearnEarnedForUser(): TYDaemonEarned {
	const {address} = useWeb3();
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();

	const {data: earned} = useFetch<TYDaemonEarned>({
		endpoint: address
			? `${yDaemonBaseUriWithoutChain}/earned/${address}?${new URLSearchParams({
					chainIDs: [1, 10].join(',')
				})}`
			: null,
		schema: yDaemonEarnedSchema
	});

	const memorizedEarned = useDeepCompareMemo((): TYDaemonEarned => {
		if (!earned) {
			return {
				earned: {},
				totalRealizedGainsUSD: 0,
				totalUnrealizedGainsUSD: 0
			};
		}
		return earned;
	}, [earned]);

	return memorizedEarned;
}

export {useFetchYearnEarnedForUser};
