import React from 'react';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {TDropdownOption} from '@common/types/types';

type TSetZapOptionProps = {
	name: string;
	symbol: string;
	address: string;
	safeChainID: number;
	decimals: number;
}
export function	setZapOption({name, symbol, address, safeChainID, decimals}: TSetZapOptionProps): TDropdownOption {
	return ({
		label: name,
		symbol,
		value: address,
		decimals,
		icon: <ImageWithFallback
			src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${address}/logo-128.png`}
			alt={name}
			width={36}
			height={36} />
	});
}