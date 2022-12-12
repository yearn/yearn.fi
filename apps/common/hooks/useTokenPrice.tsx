
import {useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useYearn} from '@common/contexts/useYearn';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';

function	useTokenPrice(address: string | TAddress): number {
	const {prices} = useYearn();

	const tokenPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[toAddress(address)] || 0),
			6
		)
	), [address, prices]);

	return tokenPrice;
}

export {useTokenPrice};