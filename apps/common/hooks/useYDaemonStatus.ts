import useSWR from 'swr';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {SWRResponse} from 'swr';

type TProps = {
	chainID: number | string;
};

function useYDaemonStatus<T>({chainID}: TProps): SWRResponse<T> | null {
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID});
	const result = useSWR<T>(`${yDaemonBaseUri}/status`, baseFetcher, {revalidateOnFocus: false});

	if (!result.data || result.isLoading || result.isValidating) {
		return result;
	}

	return result;
}

export {useYDaemonStatus};
