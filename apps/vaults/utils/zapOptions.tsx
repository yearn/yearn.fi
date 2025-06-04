import {ImageWithFallback} from '@lib/components/ImageWithFallback';

import type {TAddress, TDropdownOption} from '@lib/types';
import type {TSolver} from '@vaults/types/solvers';

type TSetZapOptionProps = {
	name: string;
	symbol: string;
	address: TAddress;
	chainID: number;
	decimals: number;
	solveVia?: TSolver[];
};
export function setZapOption({
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
		solveVia: solveVia as any,
		chainID,
		icon: (
			<ImageWithFallback
				src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainID}/${address}/logo-32.png`}
				alt={name}
				width={24}
				height={24}
			/>
		)
	};
}
