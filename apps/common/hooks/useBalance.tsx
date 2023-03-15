
import {useMemo} from 'react';
import {VoidTBalanceData} from '@yearn-finance/web-lib/hooks/useBalances';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';

import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

function	useBalance(
	address: string | TAddress,
	source?: TDict<TBalanceData>
): TBalanceData {
	const	{balances, balancesNonce} = useWallet();

	const	balance = useMemo((): TBalanceData => {
		balancesNonce; // remove warning, force deep refresh
		if (source?.[toAddress(address)]) {
			return source[toAddress(address)] || VoidTBalanceData;
		}
		return balances?.[toAddress(address)] || VoidTBalanceData;
	}, [source, balances, address, balancesNonce]);

	return balance;
}

export {useBalance};
