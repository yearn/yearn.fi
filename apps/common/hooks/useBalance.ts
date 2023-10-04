import {useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useWallet} from '@common/contexts/useWallet';

import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export function useBalance({address, chainID, source}: {address: string | TAddress; chainID: number; source?: TDict<TNormalizedBN>}): TNormalizedBN {
	const {getBalance} = useWallet();

	const balance = useMemo((): TNormalizedBN => {
		if (source) {
			return source?.[toAddress(address)] || toNormalizedBN(0);
		}
		return getBalance({address: toAddress(address), chainID: chainID});
	}, [source, getBalance, address]);

	return balance;
}
