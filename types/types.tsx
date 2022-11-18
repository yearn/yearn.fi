import {ReactElement} from 'react';
import {BigNumber} from 'ethers';

import type {TDict} from '@yearn-finance/web-lib/utils';

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
	balances?: TDict<TSimplifiedBalanceData>
};

export type TDropdownItemProps = {
	option: TDropdownOption;
	onSelect: (option: TDropdownOption) => void;
	balances?: TDict<TSimplifiedBalanceData>;
	buttonRef: React.RefObject<HTMLButtonElement>;
};

export type	TNormalizedBN = {
	raw: BigNumber,
	normalized: number | string,
}
