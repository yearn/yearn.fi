
import {useMemo} from 'react';
import {ethers} from 'ethers';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';

import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

function	useBalance(
	address: string | TAddress,
	source?: TDict<TBalanceData>
): TBalanceData {
	const	{balances} = useWallet();

	const	balance = useMemo((): TBalanceData => {
		if (source) {
			return source?.[toAddress(address)] || {normalized: 0, raw: ethers.constants.Zero};
		}
		return balances?.[toAddress(address)] || {normalized: 0, raw: ethers.constants.Zero};
	}, [source, balances, address]);

	return balance;
}

export {useBalance};