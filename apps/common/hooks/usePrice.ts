import {useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export function usePrice({address, chainID}: {address: string | TAddress; chainID: number}): TNormalizedBN {
	const {getPrice} = useWallet();

	const balance = useMemo((): TNormalizedBN => {
		return getPrice({address: toAddress(address), chainID: chainID});
	}, [getPrice, address]);

	return balance;
}
