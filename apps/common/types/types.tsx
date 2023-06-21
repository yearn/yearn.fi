import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';

export type	TClaimable = {
	raw: bigint,
	normalized: number,
}

export type	TSimplifiedBalanceData = {
	decimals: number,
	symbol: string,
	raw: bigint,
	normalized: number,
	normalizedPrice: number,
}

export type TDropdownOption = {
	label: string;
	symbol: string;
	decimals: number;
	value: TAddress;
	icon?: ReactElement;
	zapVia?: TAddress;
	solveVia?: TSolver[];
	balanceSource?: string;
	settings?: {
		shouldNotBeWithdrawTarget?: boolean;
		shouldHideIfZero?: boolean
	}
};

export type TDropdownProps = {
	options: TDropdownOption[];
	defaultOption: TDropdownOption;
	selected?: TDropdownOption;
	placeholder?: string;
	onSelect:
	| React.Dispatch<React.SetStateAction<TDropdownOption>>
	| ((option: TDropdownOption) => void);
	balanceSource?: TDict<TBalanceData>;
};

export type TDropdownItemProps = {
	option: TDropdownOption;
	balanceSource?: TDict<TBalanceData>;
};

export type TDropdownGaugeOption = {
	label: string;
	icon?: ReactElement;
	value: {
		name: string,
		tokenAddress: TAddress,
		poolAddress: TAddress,
		gaugeAddress: TAddress,
		APY: number
	};
};
export type TDropdownGaugeProps = {
	options: TDropdownGaugeOption[];
	selected?: TDropdownGaugeOption;
	placeholder?: string;
	onSelect:
	| React.Dispatch<React.SetStateAction<TDropdownGaugeOption>>
	| ((option: TDropdownGaugeOption) => void);
};

export type TDropdownGaugeItemProps = {
	option: TDropdownGaugeOption;
};

export type	TNormalizedBN = {
	raw: bigint,
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

export type TSortDirection = 'asc' | 'desc' | '';
