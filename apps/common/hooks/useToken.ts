import {useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TToken} from '@common/types/types';

export function useToken({address, chainID}: {address: string | TAddress; chainID: number}): TToken {
	const {getToken} = useWallet();

	const balance = useMemo((): TToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address]);

	return balance;
}
