
import {useMemo} from 'react';
import {ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useYearn} from '@common/contexts/useYearn';

import type {TAddress} from '@yearn-finance/web-lib/types';

export function useTokenPrice(address: TAddress): number {
	const {prices} = useYearn();

	const tokenPrice = useMemo((): number => {
		if (address === YFI_ADDRESS) {
			return 5150.96; //TODO: REMOVE
		}
		if (address === ETH_TOKEN_ADDRESS) {
			return 1601.69; //TODO: REMOVE
		}
		return formatToNormalizedValue(toBigInt(prices?.[address] || 0), 6);
	}, [address, prices]);

	return tokenPrice;
}
