import {useMemo} from 'react';
import {toAddress} from '@builtbymom/web3/utils';
import {useWallet} from '@common/contexts/useWallet';

import type {TAddress} from '@builtbymom/web3/types';
import type {TYToken} from '@common/types/types';

export function useToken({address, chainID}: {address: string | TAddress; chainID: number}): TYToken {
	const {getToken} = useWallet();

	const balance = useMemo((): TYToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address]);

	return balance;
}
