import {useMemo} from 'react';
import {toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';
import {useYearn} from '@common/contexts/useYearn';

import type {TAddress} from '@builtbymom/web3/types';

export function useTokenPrice({address, chainID}: {address: TAddress; chainID: number}): number {
	const {prices} = useYearn();

	const tokenPrice = useMemo(
		(): number => toNormalizedValue(toBigInt(prices?.[chainID]?.[address] || 0), 6),
		[address, prices, chainID]
	);

	return tokenPrice;
}
