import React from 'react';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TDropdownOption} from '@common/types/types';
import type {Solver} from '@vaults/contexts/useSolver';

type TSetZapOptionProps = {
	address: TAddress;
	decimals: bigint;
	name: string;
	symbol: string;
	chainID: number;
	solveVia?: Solver[]
}
export function	setZapOption({
	name,
	symbol,
	address,
	chainID,
	decimals,
	solveVia
}: TSetZapOptionProps): TDropdownOption {
	return {
		label: name,
		symbol,
		value: address,
		decimals,
		solveVia,
		icon: <ImageWithFallback
			src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${address}/logo-128.png`}
			alt={name}
			width={36}
			height={36} />
	};
}
