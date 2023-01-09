
import {useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';
import {toNormalizedBN} from '@common/utils';

import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

function	useBalance(
	address: string | TAddress,
	source?: TDict<TBalanceData>
): TBalanceData {
	const	{balances, balancesNonce} = useWallet();

	const	balance = useMemo((): TBalanceData => {
		balancesNonce; // remove warning, force deep refresh
		if (source) {
			return source?.[toAddress(address)] || toNormalizedBN(0);
		}
		return balances?.[toAddress(address)] || toNormalizedBN(0);
	}, [source, balances, address, balancesNonce]);

	return balance;
}

export {useBalance};
