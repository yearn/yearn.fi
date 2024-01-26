import {useMemo} from 'react';
import {toAddress} from '@builtbymom/web3/utils';
import {useWallet} from '@common/contexts/useWallet';

import type {TAddress, TNormalizedBN} from '@builtbymom/web3/types';

export function usePrice({address, chainID}: {address: string | TAddress; chainID: number}): TNormalizedBN {
	const {getPrice} = useWallet();

	const balance = useMemo((): TNormalizedBN => {
		return getPrice({address: toAddress(address), chainID: chainID});
	}, [getPrice, address, chainID]);

	return balance;
}
