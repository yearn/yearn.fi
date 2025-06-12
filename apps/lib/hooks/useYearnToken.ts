import {useMemo} from 'react';
import {toAddress} from '@lib/utils';

import {useYearn} from '../contexts/useYearn';

import type {TAddress, TToken} from '@lib/types';

/******************************************************************************
 ** The useYearnToken hook is used to retrieve the token from the useWallet
 ** context. The token is returned as a TYToken.
 *****************************************************************************/
export function useYearnToken({address, chainID}: {address: string | TAddress; chainID: number}): TToken {
	const {getToken} = useYearn();

	const balance = useMemo((): TToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address, chainID]);

	return balance;
}
