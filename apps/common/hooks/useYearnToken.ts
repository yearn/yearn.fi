import {useMemo} from 'react';
import {toAddress} from '@builtbymom/web3/utils';

import {useYearn} from '../contexts/useYearn';

import type {TYToken} from '@web-lib/types';
import type {TAddress} from '@builtbymom/web3/types';

/******************************************************************************
 ** The useYearnToken hook is used to retrieve the token from the useWallet
 ** context. The token is returned as a TYToken.
 *****************************************************************************/
export function useYearnToken({address, chainID}: {address: string | TAddress; chainID: number}): TYToken {
	const {getToken} = useYearn();

	const balance = useMemo((): TYToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address, chainID]);

	return balance;
}
