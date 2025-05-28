import {toAddress} from '@builtbymom/web3/utils';

import {useYearn} from '../contexts/useYearn';

import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

/******************************************************************************
 ** The useYearnBalance hook is used to retrieve the balance of a token from
 ** the useYearn context.
 *****************************************************************************/
export function useYearnBalance({
	address,
	chainID
}: {
	address: string | TAddress;
	chainID: number;
	source?: TDict<TNormalizedBN>;
}): TNormalizedBN {
	const {getBalance} = useYearn();

	return getBalance({address: toAddress(address), chainID: chainID});
}
