import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type	TClaimable = {
	raw: BigNumber,
	normalized: number,
}

export type	TSimplifiedBalanceData = {
	decimals: number,
	symbol: string,
	raw: BigNumber,
	normalized: number,
	normalizedPrice: number,
}

export type TDropdownOption = {
	icon?: ReactElement;
	label: string;
	symbol: string;
	decimals: number;
	value: string;
	zapVia?: string;
};

export type TDropdownProps = {
	options: TDropdownOption[];
	defaultOption: TDropdownOption;
	selected?: TDropdownOption;
	placeholder?: string;
	onSelect:
		| React.Dispatch<React.SetStateAction<TDropdownOption>>
		| ((option: TDropdownOption) => void);
};

export type TDropdownItemProps = {
	option: TDropdownOption;
	balances?: TDict<TSimplifiedBalanceData>;
};

export type	TNormalizedBN = {
	raw: BigNumber,
	normalized: number | string,
}

export type TGraphData = {
	name: string;
	value: number;
}

export type TMessariGraphData = {
	name: string;
	tvl: number;
	pps: number;
}