import useSWR from 'swr';
import {baseFetcher} from '@builtbymom/web3/utils';

import {useYDaemonBaseURI} from './useYDaemonBaseURI';

import type {SWRResponse} from 'swr';

type TProps = {
	chainID: number | string;
};

/******************************************************************************
 ** The useYDaemonStatus hook is used to fetch the status of the yDaemon API.
 ** It returns an object with the status of the API.
 *****************************************************************************/
export function useYDaemonStatus<T>({chainID}: TProps): SWRResponse<T> | null {
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID});
	const result = useSWR<T>(`${yDaemonBaseUri}/status`, baseFetcher, {
		revalidateOnFocus: false
	});

	if (!result.data || result.isLoading) {
		return result;
	}

	return result;
}
