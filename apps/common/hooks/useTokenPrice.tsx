
import {useMemo} from 'react';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useYearn} from '@common/contexts/useYearn';

import type {TAddress} from '@yearn-finance/web-lib/types';

function	useTokenPrice(address: TAddress): number {
	const {prices} = useYearn();

	const tokenPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[address] || 0),
			6
		)
	), [address, prices]);

	return tokenPrice;
}

export {useTokenPrice};
