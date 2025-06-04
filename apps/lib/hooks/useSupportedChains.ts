import {useMemo} from 'react';

import {retrieveConfig} from '../utils/wagmi';

import type {Chain} from 'viem/chains';

/******************************************************************************
 ** The useSupportedChains hook returns an array of supported chains, based on
 ** the injected connector.
 *****************************************************************************/
export function useSupportedChains(): Chain[] {
	const supportedChains = useMemo((): Chain[] => {
		const config = retrieveConfig();
		const noFork = config.chains.filter(({id}): boolean => id !== 1337);
		return noFork;
	}, []);

	return supportedChains;
}
